"""
SessionPlanner — "what should this child learn next?"

This answers WHAT to teach and is deliberately deterministic: mastery gaps
first, then due revisions, then educator assignments. It is NEVER randomized
(docs/ARCHITECTURE.md §2 step 2) — only HOW a topic is taught is an experiment.
"""
from dataclasses import dataclass

from sqlalchemy.orm import Session as DBSession

from app.engine.learner_model import LearnerModel
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

    def next_topic(self, child_id: str) -> TopicChoice:
        """Phase 1: pick the topic with the lowest current mastery among all
        seeded topics (README §9). Revision scheduling (RetentionModel) and
        educator overrides are layered on in later phases without changing
        this return type."""
        topics = self.db.query(Topic).all()
        if not topics:
            raise ValueError("No topics seeded — run scripts/seed.py")

        scored = [(t, self.learner_model.get_mastery(child_id, t.id).p) for t in topics]
        topic, _ = min(scored, key=lambda pair: pair[1])
        return TopicChoice(topic_id=topic.id, topic_code=topic.code, reason="lowest_mastery")
