"""
LearnerModel — "what does the child know?"

Phase 1 implementation: Bayesian knowledge tracing via a Beta posterior over
per-topic mastery (a simple, interpretable stand-in — see docs/ARCHITECTURE.md
§3, upgraded to deep knowledge tracing later per docs/PLAN.md Phase 5+).

Deliberately framework-free (no FastAPI imports) so it can be driven directly
by the simulator in research/ without a server or HTTP layer.
"""
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.orm import Session as DBSession

from app.models.profile_state import MasteryState


@dataclass
class Mastery:
    p: float  # posterior mean, 0..1
    sd: float
    n_trials: int


class LearnerModel:
    """Beta(alpha, beta) posterior per (child, topic). alpha/beta are derived
    from p_mastery/sd/trials stored on MasteryState, so the DB stays the
    single source of truth and this class holds no state of its own."""

    PRIOR_ALPHA = 2.0
    PRIOR_BETA = 2.0  # weakly informative prior: assume nothing at first

    def __init__(self, db: DBSession):
        self.db = db

    def _row(self, child_id: str, topic_id: str) -> MasteryState:
        row = (
            self.db.query(MasteryState)
            .filter_by(child_id=child_id, topic_id=topic_id)
            .one_or_none()
        )
        if row is None:
            row = MasteryState(
                child_id=child_id,
                topic_id=topic_id,
                p_mastery=self.PRIOR_ALPHA / (self.PRIOR_ALPHA + self.PRIOR_BETA),
                sd=self._beta_sd(self.PRIOR_ALPHA, self.PRIOR_BETA),
                trials=0,
            )
            self.db.add(row)
            self.db.flush()
        return row

    @staticmethod
    def _beta_sd(alpha: float, beta: float) -> float:
        return ((alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1))) ** 0.5

    def get_mastery(self, child_id: str, topic_id: str) -> Mastery:
        row = self._row(child_id, topic_id)
        return Mastery(p=row.p_mastery, sd=row.sd, n_trials=row.trials)

    def update(self, child_id: str, topic_id: str, correct: bool) -> Mastery:
        """One Bayesian update per answer. Reconstructs alpha/beta from the
        stored mean+trials (avoids a second pair of columns for the same
        information), updates, and writes back."""
        row = self._row(child_id, topic_id)
        n = max(row.trials, 0)
        # Recover pseudo-counts implied by the stored mean, seeded from the prior.
        alpha = self.PRIOR_ALPHA + row.p_mastery * n
        beta = self.PRIOR_BETA + (1 - row.p_mastery) * n

        if correct:
            alpha += 1
        else:
            beta += 1

        row.trials = n + 1
        row.p_mastery = alpha / (alpha + beta)
        row.sd = self._beta_sd(alpha, beta)
        row.last_practised_at = datetime.now(timezone.utc)
        row.updated_at = row.last_practised_at
        self.db.flush()
        return Mastery(p=row.p_mastery, sd=row.sd, n_trials=row.trials)
