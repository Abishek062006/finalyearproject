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

    def estimate(self, recent_abandon_rate: float, recent_error_streak: int, self_report: float = 0.0) -> DistressReading:
        """Phase 1: a simple rule, not a diagnosis (README §17). Replaced by
        EngagementModel's sequence model in docs/PLAN.md Phase 6.

        `self_report` is what the child told us directly (a Break press, an
        upset "How do I feel?" answer — services/signal_service.py). It is
        never averaged away by good behaviour: the higher of the two wins."""
        behaviour = recent_abandon_rate * 0.6 + min(recent_error_streak, 5) / 5 * 0.4
        level = min(1.0, max(behaviour, self_report))
        return DistressReading(level=level, rising=level >= self.RISING_THRESHOLD)


class TherapistLocks:
    def __init__(self, db: DBSession):
        self.db = db

    def allowed_arms(self, child_id: str, axis_id: str, all_arm_ids: list[str]) -> list[str]:
        """An educator can block (or later re-allow) specific arms per child
        (README §21). Locks are append-only, like consent (docs/SCHEMA.md
        §6) — so the current state of an arm is whichever lock row for it
        was written most recently, NOT "was it ever blocked". Reading only
        allow=False rows here would mean an educator un-blocking an arm
        (a new allow=True row) could never take effect; that was a real bug,
        fixed by taking the latest row per arm.

        If everything ends up blocked, callers fall back to the axis's safe-
        default arm."""
        rows = (
            self.db.query(ArmLock)
            .filter_by(child_id=child_id, axis_id=axis_id)
            .order_by(ArmLock.created_at.desc())
            .all()
        )
        latest_allow: dict[str, bool] = {}
        for lock in rows:
            latest_allow.setdefault(lock.arm_id, lock.allow)
        return [a for a in all_arm_ids if latest_allow.get(a, True)]
