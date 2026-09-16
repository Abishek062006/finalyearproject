from research.simulator.child import METHOD_ARMS, MODALITY_ARMS

from .base import BaselinePolicy

ASSESSMENT_TRIALS = 8  # two full passes through the 2x2 rotation below


class ExpertManualPolicy(BaselinePolicy):
    """Baseline 5: README §2's "assessment-based instruction" (Kodak & Halbur
    2021) — a human expert manually crosses method x modality over a short,
    FIXED-order assessment window (no matched item sets, no posterior, no
    randomization — deliberately cruder than AURA's design), picks whichever
    arm had the higher raw accuracy during that window, and locks it in
    forever. Unlike AURA, there is no drift-triggered re-testing: a real
    manual assessment is "done once", per README's own framing. Theme is
    left at a fixed default — the cited assessment protocol targets teaching
    method / error-correction approach, not interest theme, and no published
    equivalent protocol exists to model there."""

    name = "expert_manual"
    ROTATION = [("errorless", "tap"), ("try_then_correct", "drag_drop"), ("errorless", "drag_drop"), ("try_then_correct", "tap")]

    def __init__(self, theme: str = "dino"):
        self.theme = theme
        self._trial = 0
        self._method_stats: dict[str, list[bool]] = {a: [] for a in METHOD_ARMS}
        self._modality_stats: dict[str, list[bool]] = {a: [] for a in MODALITY_ARMS}
        self._locked: dict[str, str] | None = None

    def choose_arms(self) -> dict[str, str]:
        if self._locked is not None:
            return dict(self._locked)
        method, modality = self.ROTATION[self._trial % len(self.ROTATION)]
        return {"teaching_method": method, "modality": modality, "theme": self.theme}

    def record_outcome(self, arms: dict[str, str], correct: bool) -> None:
        if self._locked is not None:
            return
        self._method_stats[arms["teaching_method"]].append(correct)
        self._modality_stats[arms["modality"]].append(correct)
        self._trial += 1
        if self._trial >= ASSESSMENT_TRIALS:
            best_method = max(METHOD_ARMS, key=lambda a: self._rate(self._method_stats[a]))
            best_modality = max(MODALITY_ARMS, key=lambda a: self._rate(self._modality_stats[a]))
            self._locked = {"teaching_method": best_method, "modality": best_modality, "theme": self.theme}

    @staticmethod
    def _rate(outcomes: list[bool]) -> float:
        return sum(outcomes) / len(outcomes) if outcomes else 0.0
