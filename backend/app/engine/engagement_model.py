"""
EngagementModel — "is this child still with us?"

Phase 1 (README §14): rules over observable behaviour — response-time trend,
error streaks, abandonment — never a claim about boredom, mood, or emotional
health. Output is an ESTIMATE with three states (high/stable/declining), plus
the two numbers DistressMonitor (app/engine/safety.py) already knew how to
turn into a safety decision but had never actually been fed (decision_engine.py
hardcoded distress_level=0.0 since Phase 1).
"""
from dataclasses import dataclass

from sqlalchemy.orm import Session as DBSession

from app.models.runtime import ActivityInstance, Interaction

WINDOW = 5  # recent answers considered "current" behaviour
DECLINE_ERROR_STREAK = 2  # consecutive wrong answers that alone signal decline
DECLINE_RESPONSE_TIME_RATIO = 1.6  # recent answers this much slower than this session's own baseline
MIN_INTERACTIONS_FOR_A_READING = 3  # below this, there isn't enough evidence yet

ENGAGEMENT_SCORE = {"high": 1.0, "stable": 0.7, "declining": 0.3}


def engagement_score(reading: "EngagementReading") -> float:
    return ENGAGEMENT_SCORE[reading.state]


@dataclass
class EngagementReading:
    state: str  # "high" | "stable" | "declining"
    recent_error_streak: int
    recent_abandon_rate: float
    avg_response_time_ms: float | None
    n_considered: int


class EngagementModel:
    def __init__(self, db: DBSession):
        self.db = db

    def _session_answers(self, session_id: str) -> list[Interaction]:
        return (
            self.db.query(Interaction)
            .join(ActivityInstance, ActivityInstance.id == Interaction.activity_instance_id)
            .filter(ActivityInstance.session_id == session_id, Interaction.kind == "answer")
            .order_by(Interaction.server_time.asc())
            .all()
        )

    def estimate(self, child_id: str, session_id: str) -> EngagementReading:
        answers = self._session_answers(session_id)

        activities = self.db.query(ActivityInstance).filter_by(session_id=session_id).all()
        started = [a for a in activities if a.ended_at is None and not a.completed]
        # An activity still open with no more recent answers than the window
        # size is treated as abandoned for this reading — a real "walked away
        # mid-task" signal distinct from just answering slowly.
        abandon_rate = 0.0
        if activities:
            abandoned = sum(1 for a in started if a.id not in {ans.activity_instance_id for ans in answers[-WINDOW:]})
            abandon_rate = abandoned / len(activities)

        if len(answers) < MIN_INTERACTIONS_FOR_A_READING:
            return EngagementReading(
                state="stable", recent_error_streak=0, recent_abandon_rate=abandon_rate,
                avg_response_time_ms=None, n_considered=len(answers),
            )

        recent = answers[-WINDOW:]
        earlier = answers[:-WINDOW] or recent  # if there's no "earlier" yet, compare against itself (no signal either way)

        recent_error_streak = 0
        for a in reversed(answers):
            if a.correct is False:
                recent_error_streak += 1
            else:
                break

        recent_avg_rt = sum(a.response_time_ms or 0 for a in recent) / len(recent)
        baseline_avg_rt = sum(a.response_time_ms or 0 for a in earlier) / len(earlier)
        rt_ratio = (recent_avg_rt / baseline_avg_rt) if baseline_avg_rt > 0 else 1.0

        declining = (
            recent_error_streak >= DECLINE_ERROR_STREAK
            or rt_ratio >= DECLINE_RESPONSE_TIME_RATIO
            or abandon_rate >= 0.5
        )
        recent_error_rate = sum(1 for a in recent if a.correct is False) / len(recent)
        high = not declining and recent_error_rate <= 0.2 and rt_ratio <= 1.1

        state = "declining" if declining else ("high" if high else "stable")
        return EngagementReading(
            state=state, recent_error_streak=recent_error_streak, recent_abandon_rate=abandon_rate,
            avg_response_time_ms=recent_avg_rt, n_considered=len(answers),
        )
