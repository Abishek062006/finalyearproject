"""
Shared interface for the 5 comparison systems (docs/PLAN.md Phase 8, README
§2 "Evaluation: against 5 baselines"). Deliberately NOT built on
app.engine.experiment_manager/effect_estimator — that machinery IS the thing
under test. Each baseline is a much simpler policy: "which arm for each
lesson axis this activity", plus an optional hook to react to what happened,
driven by research/harness.py against the SAME simulated child and the SAME
real LearnerModel/RetentionModel measurement instruments AURA uses, so only
the decision logic differs between conditions.
"""
from abc import ABC, abstractmethod


class BaselinePolicy(ABC):
    name: str

    @abstractmethod
    def choose_arms(self) -> dict[str, str]:
        """{"teaching_method": arm_code, "modality": arm_code, "theme": arm_code}"""
        raise NotImplementedError

    def record_outcome(self, arms: dict[str, str], correct: bool) -> None:
        """Called once per answered item. No-op for non-adaptive baselines."""
        return None
