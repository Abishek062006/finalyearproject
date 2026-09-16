from .base import BaselinePolicy
from .static import DEFAULT_ARMS


class CorrelationalPersonalizationPolicy(BaselinePolicy):
    """Baseline 3: picks arms ONCE from a short early "assessment" (a few
    trials under neutral default arms — see research/run_simulation_study.py's
    `run_correlational_probe`), bucketed by that assessment's raw accuracy,
    then looks up whichever arm combo correlated best with success for
    calibration-population children in the SAME bucket. This is exactly the
    failure mode README §2 motivates AURA against: inferring "what works for
    this child" from an OBSERVATIONAL correlate and population data, never
    from a randomized within-child comparison — so if the true determinant
    isn't actually correlated with the observable proxy (as in this
    simulator, deliberately, since each child's true-best arm is drawn
    independently of their ability — see research/simulator/child.py), this
    baseline can do no better than chance at finding THIS child's real best
    arm, even with a large, honest calibration sample."""

    name = "correlational"

    def __init__(self, lookup: dict[str, dict[str, str]], bucket: str):
        self.arms = dict(lookup.get(bucket, DEFAULT_ARMS))

    def choose_arms(self) -> dict[str, str]:
        return dict(self.arms)
