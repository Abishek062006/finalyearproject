"""
SessionPlanner — "what should this child learn next?"

This answers WHAT to teach and is deliberately deterministic: mastery gaps
first, then due revisions, then educator assignments. It is NEVER randomized
(docs/ARCHITECTURE.md §2 step 2) — only HOW a topic is taught is an experiment.
"""
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.orm import Session as DBSession

from app.engine.learner_model import LearnerModel
from app.engine.retention_model import RetentionModel
from app.models.adults import Override
from app.models.curriculum import Domain, Topic
from app.models.identity import Child


@dataclass
class TopicChoice:
    topic_id: str
    topic_code: str
    reason: str  # "lowest_mastery" | "due_revision" | "educator_assigned"


class SessionPlanner:
    def __init__(self, db: DBSession):
        self.db = db
        self.learner_model = LearnerModel(db)
        self.retention_model = RetentionModel(db)

    def _active_topic_override(self, child_id: str) -> Topic | None:
        """README §21/§33: an educator can assign a topic, overriding the
        AI's own choice. Checked first, before mastery, so it always wins
        while unexpired (docs/PLAN.md Phase 4). Unexpired = expires_at is
        null (no limit) or still in the future."""
        now = datetime.now(timezone.utc)
        override = (
            self.db.query(Override)
            .filter(Override.child_id == child_id, Override.kind == "assign_topic")
            .order_by(Override.created_at.desc())
            .first()
        )
        if override is None:
            return None
        if override.expires_at is not None and override.expires_at.replace(tzinfo=None) < now.replace(tzinfo=None):
            return None
        topic_id = override.payload.get("topic_id")
        return self.db.query(Topic).filter_by(id=topic_id).one_or_none()

    REST_AFTER = 2  # interleave: a topic from either of the child's last 2 lessons sits out the next one
    SPACING_WEIGHT = 0.03  # per lesson since a topic was last practised...
    SPACING_CAP = 12  # ...counted up to this many lessons

    def _recent_topics(self, child_id: str, limit: int) -> list[str]:
        """Topic ids of the child's most recent lessons (any session), newest first."""
        from app.models.runtime import ActivityInstance
        from app.models.runtime import Session as SessionRow

        rows = (
            self.db.query(ActivityInstance)
            .join(SessionRow, SessionRow.id == ActivityInstance.session_id)
            .filter(SessionRow.child_id == child_id)
            .order_by(ActivityInstance.started_at.desc())
            .limit(limit * 3)
            .all()
        )
        return [a.topic_id for a in rows if not (a.spec or {}).get("is_intervention")][:limit]

    def next_topic(self, child_id: str) -> TopicChoice:
        """Priority order (README §9/§21/§33), all deterministic:
        1. an educator's explicit assignment, while unexpired
        2. a due revision probe (docs/PLAN.md Phase 5) — something the
           child is at risk of forgetting takes priority over new material
        3. the topic with the lowest current mastery, within the parent's
           goal domains when any of them have topics — interleaved: a topic
           from either of the child's last REST_AFTER lessons (across
           sessions) sits out the next one, when others are available.
           Among the rest, weaker topics come first, but a topic's priority
           also grows the longer it hasn't been practised (spacing), so the
           weakest two or three can't crowd everything else out. Mixing
           topics (interleaving) and spacing them both help memory more than
           drilling one, and endless repeats are hard going for any child.
        """
        assigned = self._active_topic_override(child_id)
        if assigned is not None:
            return TopicChoice(topic_id=assigned.id, topic_code=assigned.code, reason="educator_assigned")

        due_topic = self.retention_model.earliest_due_topic(child_id)
        if due_topic is not None:
            return TopicChoice(topic_id=due_topic.id, topic_code=due_topic.code, reason="due_revision")

        topics = self.db.query(Topic).all()
        if not topics:
            raise ValueError("No topics seeded — run scripts/seed.py")

        # The parent's onboarding goals (plan Phase 1) narrow the candidates to
        # those domains — but only when at least one goal domain actually has
        # topics yet; otherwise fall back to everything rather than stall.
        child = self.db.query(Child).filter_by(id=child_id).one_or_none()
        goals = set(child.goals or []) if child else set()
        if goals:
            goal_domain_ids = {d.id for d in self.db.query(Domain).filter(Domain.code.in_(goals)).all()}
            in_goals = [t for t in topics if t.domain_id in goal_domain_ids]
            if in_goals:
                topics = in_goals

        history = self._recent_topics(child_id, self.SPACING_CAP)
        resting = set(history[: self.REST_AFTER])
        rested = [t for t in topics if t.id not in resting]
        if rested:
            topics = rested

        def since(topic_id: str) -> int:
            return history.index(topic_id) if topic_id in history else self.SPACING_CAP

        scored = [(t, self.learner_model.get_mastery(child_id, t.id).p - self.SPACING_WEIGHT * since(t.id)) for t in topics]
        # Tie-break on topic code, not insertion order: with more than one
        # topic now seeded (docs/PLAN.md's curriculum-breadth follow-up),
        # relying on whatever order the DB happens to return rows in for a
        # plain `.all()` is fragile — make the tie-break explicit instead.
        topic, _ = min(scored, key=lambda pair: (pair[1], pair[0].code))
        return TopicChoice(topic_id=topic.id, topic_code=topic.code, reason="lowest_mastery")
