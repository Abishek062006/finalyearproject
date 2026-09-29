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

    def next_topic(self, child_id: str) -> TopicChoice:
        """Priority order (README §9/§21/§33), all deterministic:
        1. an educator's explicit assignment, while unexpired
        2. a due revision probe (docs/PLAN.md Phase 5) — something the
           child is at risk of forgetting takes priority over new material
        3. the topic with the lowest current mastery, within the parent's
           goal domains when any of them have topics
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

        scored = [(t, self.learner_model.get_mastery(child_id, t.id).p) for t in topics]
        # Tie-break on topic code, not insertion order: with more than one
        # topic now seeded (docs/PLAN.md's curriculum-breadth follow-up),
        # relying on whatever order the DB happens to return rows in for a
        # plain `.all()` is fragile — make the tie-break explicit instead.
        topic, _ = min(scored, key=lambda pair: (pair[1], pair[0].code))
        return TopicChoice(topic_id=topic.id, topic_code=topic.code, reason="lowest_mastery")
