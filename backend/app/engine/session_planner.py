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
from app.models.adults import Override
from app.models.curriculum import Topic


@dataclass
class TopicChoice:
    topic_id: str
    topic_code: str
    reason: str  # "lowest_mastery" | "due_revision" | "educator_assigned"


class SessionPlanner:
    def __init__(self, db: DBSession):
        self.db = db
        self.learner_model = LearnerModel(db)

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
        """Phase 1: pick the topic with the lowest current mastery among all
        seeded topics (README §9), unless an educator has assigned one.
        Revision scheduling (RetentionModel) is layered on in a later phase
        without changing this return type."""
        assigned = self._active_topic_override(child_id)
        if assigned is not None:
            return TopicChoice(topic_id=assigned.id, topic_code=assigned.code, reason="educator_assigned")

        topics = self.db.query(Topic).all()
        if not topics:
            raise ValueError("No topics seeded — run scripts/seed.py")

        scored = [(t, self.learner_model.get_mastery(child_id, t.id).p) for t in topics]
        topic, _ = min(scored, key=lambda pair: pair[1])
        return TopicChoice(topic_id=topic.id, topic_code=topic.code, reason="lowest_mastery")
