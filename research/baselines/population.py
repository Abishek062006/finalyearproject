from .base import BaselinePolicy
from .static import DEFAULT_ARMS


class PopulationLevelPolicy(BaselinePolicy):
    """Baseline 4: the single arm-per-axis combination that performed best
    ON AVERAGE across a calibration population, shipped identically to every
    child — the "one big RCT, one policy for everyone" approach, as opposed
    to AURA's per-child RCT. Never adapts to the individual after that.
    `best_arms` is computed once by research/run_simulation_study.py's
    calibrate() and passed in identically for every evaluated child."""

    name = "population_level"

    def __init__(self, best_arms: dict[str, str] | None = None):
        self.arms = dict(best_arms or DEFAULT_ARMS)

    def choose_arms(self) -> dict[str, str]:
        return dict(self.arms)
