from research.simulator.child import METHOD_ARMS, MODALITY_ARMS, THEME_ARMS

from .base import BaselinePolicy

WINDOW = 4  # trials on the CURRENT arm before reassessing it — small and rule-based, not a posterior
STRUGGLE_THRESHOLD = 0.5  # raw accuracy below this on the current arm -> switch


class HeuristicAdaptivePolicy(BaselinePolicy):
    """Baseline 2: docs/PLAN.md Phase 3's "deterministic adaptive core" /
    README's frozen "Baseline B" — rules over raw accuracy, no statistics, no
    randomization, no matched item sets, no posterior, no drift re-testing.
    "A child struggling gets more practice, presented differently": once
    `WINDOW` raw answers have piled up on the CURRENT arm for an axis, switch
    to the next candidate if accuracy over that window was below
    `STRUGGLE_THRESHOLD` — otherwise keep it. Cycles through theme's 4 arms
    the same way, one step at a time, rather than jumping straight to a
    "winner" — this baseline has no concept of a confirmed winner at all."""

    name = "heuristic_adaptive"
    AXIS_ARMS = {"teaching_method": METHOD_ARMS, "modality": MODALITY_ARMS, "theme": THEME_ARMS}

    def __init__(self):
        self.current = {axis: arms[0] for axis, arms in self.AXIS_ARMS.items()}
        self._window: dict[str, list[bool]] = {axis: [] for axis in self.AXIS_ARMS}

    def choose_arms(self) -> dict[str, str]:
        return dict(self.current)

    def record_outcome(self, arms: dict[str, str], correct: bool) -> None:
        for axis, arm in arms.items():
            if arm != self.current.get(axis):
                continue  # stale feedback from an arm we've already switched away from
            window = self._window[axis]
            window.append(correct)
            if len(window) < WINDOW:
                continue
            accuracy = sum(window) / len(window)
            self._window[axis] = []
            if accuracy < STRUGGLE_THRESHOLD:
                options = self.AXIS_ARMS[axis]
                idx = options.index(self.current[axis])
                self.current[axis] = options[(idx + 1) % len(options)]
