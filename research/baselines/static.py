from .base import BaselinePolicy

DEFAULT_ARMS = {"teaching_method": "errorless", "modality": "tap", "theme": "dino"}


class StaticPolicy(BaselinePolicy):
    """Baseline 1: no adaptation at all — every child gets the same fixed
    arms forever, the "ship one reasonable default" system."""

    name = "static"

    def __init__(self, arms: dict[str, str] | None = None):
        self.arms = dict(arms or DEFAULT_ARMS)

    def choose_arms(self) -> dict[str, str]:
        return dict(self.arms)
