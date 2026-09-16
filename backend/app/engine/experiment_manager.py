"""
ExperimentManager ⭐ — builds fair, matched comparisons and records exactly
what happened, so the comparison can be trusted later (docs/SCHEMA.md §3, §6).

Two active axes at a time (docs/PLAN.md Phase 4: "more than that, and you'll
never get a clear answer"). Which axes are active is configuration, not code.
"""
import random
from dataclasses import dataclass

from sqlalchemy.orm import Session as DBSession

from app.models.curriculum import ItemSet
from app.models.experiment import Arm, Assignment, Axis

ACTIVE_AXIS_CODES = ["teaching_method", "modality", "theme"]


@dataclass
class ArmChoice:
    axis_id: str
    axis_code: str
    arm_id: str
    arm_code: str
    decision_type: str  # explore | exploit | locked | safe_fallback
    reason: str
    candidate_arm_ids: list[str]


class ExperimentManager:
    def __init__(self, db: DBSession, random_seed: int | None = None):
        self.db = db
        self._rng = random.Random(random_seed)

    def active_axes(self) -> list[Axis]:
        return self.db.query(Axis).filter(Axis.code.in_(ACTIVE_AXIS_CODES)).all()

    def arms_for(self, axis_id: str) -> list[Arm]:
        return self.db.query(Arm).filter_by(axis_id=axis_id).all()

    def matched_item_set(self, topic_id: str, theme_id: str | None = None) -> ItemSet | None:
        """Returns one matched item set for the topic (optionally themed).
        All sets sharing a match_group are equal size / difficulty (enforced
        at seed/generation time — docs/SCHEMA.md §3)."""
        q = self.db.query(ItemSet).filter_by(topic_id=topic_id)
        candidates = q.all()
        if theme_id is not None:
            themed = [s for s in candidates if any(i.theme_id == theme_id for i in s.items)]
            if themed:
                candidates = themed
        return self._rng.choice(candidates) if candidates else None

    def random_seed_value(self) -> int:
        return self._rng.randint(0, 2**31 - 1)

    def record_assignment(self, db_child_id: str, choice: ArmChoice, seed: int, posterior_snapshot: dict, distress_level: float) -> Assignment:
        assignment = Assignment(
            child_id=db_child_id,
            axis_id=choice.axis_id,
            arm_id=choice.arm_id,
            candidate_arm_ids=choice.candidate_arm_ids,
            decision_type=choice.decision_type,
            reason=choice.reason,
            policy_version="dev",
            random_seed=seed,
            posterior_snapshot=posterior_snapshot,
            distress_level=distress_level,
        )
        self.db.add(assignment)
        self.db.flush()
        return assignment
