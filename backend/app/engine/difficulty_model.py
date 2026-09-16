"""
DifficultyModel — "how hard should the next item be?"

Phase 1: interpretable rules over accuracy + response time + attempts, exactly
as specified in README §12 (not correctness alone). The per-child success-rate
target (README §12's "target_success_rate") becomes an experiment axis later
(docs/PLAN.md Phase 8) instead of a fixed 0.8 for everyone.
"""
from dataclasses import dataclass


@dataclass
class RecentPerformance:
    accuracy: float          # 0..1 over the recent window
    avg_response_time_ms: float
    avg_attempts: float
    n: int


class DifficultyModel:
    DEFAULT_TARGET_SUCCESS = 0.8
    SLOW_RESPONSE_MS = 8000
    FAST_RESPONSE_MS = 3000

    def target_success_rate(self, child_id: str) -> float:
        # Phase 1: one target for everyone. Phase 8 makes this an axis.
        return self.DEFAULT_TARGET_SUCCESS

    def next_level(self, current_level: int, recent: RecentPerformance) -> int:
        """README §12:
        high accuracy + fast response + low attempts -> increase difficulty
        low accuracy + long response + repeated attempts -> reduce difficulty
        """
        if recent.n == 0:
            return current_level

        target = self.DEFAULT_TARGET_SUCCESS
        easy_signal = (
            recent.accuracy >= target
            and recent.avg_response_time_ms <= self.FAST_RESPONSE_MS
            and recent.avg_attempts <= 1.2
        )
        hard_signal = (
            recent.accuracy < target - 0.25
            or recent.avg_response_time_ms >= self.SLOW_RESPONSE_MS
            or recent.avg_attempts >= 2.0
        )

        if easy_signal:
            return min(current_level + 1, 5)
        if hard_signal:
            return max(current_level - 1, 1)
        return current_level
