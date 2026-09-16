"""
Safety layer — the distress budget and therapist locks that make exploration
safe (README §32, §33; docs/ARCHITECTURE.md §3 DecisionEngine pseudocode).

This is deliberately its own module, checked before any exploration decision,
so no other module can accidentally bypass it (docs/ARCHITECTURE.md §9).
"""
from dataclasses import dataclass

from sqlalchemy.orm import Session as DBSession

from app.models.experiment import ArmLock


@dataclass
class DistressReading:
    level: float  # 0..1, estimated from recent behaviour (EngagementModel feeds this)
    rising: bool


class DistressMonitor:
    RISING_THRESHOLD = 0.6

    def estimate(self, recent_abandon_rate: float, recent_error_streak: int) -> DistressReading:
        """Phase 1: a simple rule, not a diagnosis (README §17). Replaced by
        EngagementModel's sequence model in docs/PLAN.md Phase 6."""
        level = min(1.0, recent_abandon_rate * 0.6 + min(recent_error_streak, 5) / 5 * 0.4)
        return DistressReading(level=level, rising=level >= self.RISING_THRESHOLD)


class TherapistLocks:
    def __init__(self, db: DBSession):
        self.db = db

    def allowed_arms(self, child_id: str, axis_id: str, all_arm_ids: list[str]) -> list[str]:
        """An educator can block specific arms per child (README §21). Returns
        the subset of all_arm_ids that are not blocked. If everything is
        blocked, callers fall back to the axis's safe-default arm."""
        blocked = {
            lock.arm_id
            for lock in self.db.query(ArmLock)
            .filter_by(child_id=child_id, axis_id=axis_id, allow=False)
            .all()
        }
        return [a for a in all_arm_ids if a not in blocked]
