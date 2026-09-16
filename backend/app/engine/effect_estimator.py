"""
EffectEstimator ⭐ — turns logged assignments + outcomes into a per-child,
per-arm belief. This is the piece that answers "did this actually work for
THIS child?" instead of "what did this child click on?" (docs/ARCHITECTURE.md §3).

Phase 1: Beta-Binomial posterior per (child, axis, arm), pooled with a
population-level prior so a brand-new child isn't starting from nothing
(the "hierarchical" part promised in README §34 / docs/PLAN.md Phase 4).
Deep/hierarchical-Bayesian upgrades come later without changing this interface.
"""
from dataclasses import dataclass

from sqlalchemy.orm import Session as DBSession

from app.models.experiment import Assignment, Outcome

MIN_EVIDENCE_TRIALS = 8  # below this, we don't declare a winner (docs/PLAN.md Phase 4)
DRIFT_WINDOW = 5  # recent trials to compare against the lifetime posterior
DRIFT_DROP_THRESHOLD = 0.3  # absolute accuracy drop that reopens exploration


@dataclass
class Posterior:
    arm_id: str
    mean: float
    ci_low: float
    ci_high: float
    n: int


@dataclass
class Verdict:
    arm_id: str
    mean: float
    ci_low: float
    ci_high: float
    evidence_trials: int


class EffectEstimator:
    def __init__(self, db: DBSession, population_alpha: float = 2.0, population_beta: float = 2.0):
        self.db = db
        self.population_alpha = population_alpha
        self.population_beta = population_beta

    def _outcomes_for(self, child_id: str, axis_id: str, kind: str = "immediate"):
        return (
            self.db.query(Assignment, Outcome)
            .join(Outcome, Outcome.assignment_id == Assignment.id)
            .filter(Assignment.child_id == child_id, Assignment.axis_id == axis_id, Outcome.kind == kind)
            .all()
        )

    def posterior(self, child_id: str, axis_id: str, arm_id: str, kind: str = "immediate") -> Posterior:
        rows = self._outcomes_for(child_id, axis_id, kind)
        alpha, beta, n = self.population_alpha, self.population_beta, 0
        for assignment, outcome in rows:
            if assignment.arm_id != arm_id:
                continue
            successes = outcome.value * outcome.n
            alpha += successes
            beta += outcome.n - successes
            n += outcome.n
        mean = alpha / (alpha + beta)
        sd = ((alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1))) ** 0.5
        return Posterior(arm_id=arm_id, mean=mean, ci_low=max(0, mean - 1.96 * sd), ci_high=min(1, mean + 1.96 * sd), n=n)

    def recent_accuracy(self, child_id: str, axis_id: str, arm_id: str, window: int = DRIFT_WINDOW, kind: str = "immediate") -> tuple[float, int] | None:
        """Mean outcome value over the most recent `window` trials for this
        arm, most-recent first. Returns None if there aren't enough recent
        trials to judge drift from. Used to catch a previously-confirmed
        winner that has stopped working (docs/PLAN.md Phase 4: "drift-
        triggered re-testing") — a plain lifetime Bayesian average alone
        would absorb a real regression very slowly once evidence has piled up."""
        rows = (
            self.db.query(Outcome)
            .join(Assignment, Assignment.id == Outcome.assignment_id)
            .filter(Assignment.child_id == child_id, Assignment.axis_id == axis_id, Assignment.arm_id == arm_id, Outcome.kind == kind)
            .order_by(Outcome.measured_at.desc())
            .limit(window)
            .all()
        )
        if len(rows) < window:
            return None
        return sum(r.value for r in rows) / len(rows), len(rows)

    def drift_detected(self, child_id: str, axis_id: str, arm_id: str) -> bool:
        lifetime = self.posterior(child_id, axis_id, arm_id)
        recent = self.recent_accuracy(child_id, axis_id, arm_id)
        if recent is None or lifetime.n < MIN_EVIDENCE_TRIALS:
            return False
        recent_mean, _ = recent
        return (lifetime.mean - recent_mean) > DRIFT_DROP_THRESHOLD

    def winner(self, child_id: str, axis_id: str, arm_ids: list[str]) -> Verdict | None:
        """Only declares a winner once there is enough evidence AND the
        confidence intervals of the top two arms don't overlap — a cheap,
        honest substitute for a full sequential test (docs/PLAN.md Phase 4).

        A winner whose recent trials have drifted well below its lifetime
        average is NOT re-confirmed here, even if the lifetime posterior
        still looks good — this reopens exploration for a child who has
        changed rather than trusting stale evidence (docs/PLAN.md Phase 4:
        "drift-triggered re-testing")."""
        posteriors = sorted(
            (self.posterior(child_id, axis_id, a) for a in arm_ids),
            key=lambda p: p.mean,
            reverse=True,
        )
        if not posteriors:
            return None
        best = posteriors[0]
        if best.n < MIN_EVIDENCE_TRIALS:
            return None
        if len(posteriors) > 1 and posteriors[1].ci_high >= best.ci_low:
            return None  # arms are still statistically indistinguishable
        if self.drift_detected(child_id, axis_id, best.arm_id):
            return None  # previously-strong arm is regressing for this child right now
        return Verdict(
            arm_id=best.arm_id, mean=best.mean, ci_low=best.ci_low, ci_high=best.ci_high, evidence_trials=best.n
        )
