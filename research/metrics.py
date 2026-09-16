"""
Metric definitions for the simulation and ablation studies (docs/PLAN.md
Phase 8: "sessions-to-decision, cumulative regret, trials to mastery, 7-day
retention, engagement recovery rate, distress events").

Every metric operates on plain per-trial/per-activity records the harness
logs while driving a condition (research/harness.py) — nothing here talks to
the database directly except retention_7d, which asks the real RetentionModel
for its forgetting-curve prediction 7 days after the child's last practice.
"""
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone


@dataclass
class TrialRecord:
    activity_index: int
    correct: bool | None  # None if abandoned (no answer given)
    optimal_p: float  # this child's best possible P(correct) this trial (simulator ground truth)
    actual_p: float  # P(correct) under the arms actually used this trial
    abandoned: bool = False
    is_intervention: bool = False
    mastery_after: float | None = None  # LearnerModel's real posterior mean after this trial


@dataclass
class ActivityRecord:
    activity_index: int
    arms: dict  # {} for intervention/no-lesson activities
    is_intervention: bool = False


@dataclass
class RunLog:
    condition: str
    child_index: int
    trials: list[TrialRecord] = field(default_factory=list)
    activities: list[ActivityRecord] = field(default_factory=list)
    distress_trajectory: list[float] = field(default_factory=list)  # simulator's TRUE distress, one per trial
    intervention_episodes: list[tuple[float, float]] = field(default_factory=list)  # (distress_before, distress_after)


def cumulative_regret(log: RunLog) -> float:
    return sum(
        max(0.0, t.optimal_p - t.actual_p) for t in log.trials if not t.is_intervention and not t.abandoned
    )


def regret_curve(log: RunLog) -> list[float]:
    out, running = [], 0.0
    for t in log.trials:
        if not t.is_intervention and not t.abandoned:
            running += max(0.0, t.optimal_p - t.actual_p)
        out.append(running)
    return out


def sessions_to_decision(log: RunLog, true_best_axes: dict[str, str]) -> int | None:
    """The activity index after which the policy's chosen arms match this
    child's true best arms for every remaining activity in the run — i.e.
    when it locked onto the RIGHT answer and never left it again. `None` if
    it never converges to the correct answer by the end of the run (it may
    still have "locked in" on a WRONG arm — that's exactly the failure mode
    this metric is meant to expose, not paper over)."""
    lesson = [a for a in log.activities if not a.is_intervention and a.arms]
    if not lesson:
        return None
    last_mismatch = -1
    for i, a in enumerate(lesson):
        if any(a.arms.get(axis) != val for axis, val in true_best_axes.items()):
            last_mismatch = i
    if last_mismatch == len(lesson) - 1:
        return None
    return last_mismatch + 1


def trials_to_mastery(log: RunLog, threshold: float = 0.8) -> int | None:
    for i, t in enumerate(log.trials):
        if t.mastery_after is not None and t.mastery_after >= threshold:
            return i + 1
    return None


def distress_events(log: RunLog, threshold: float = 0.6) -> int:
    """Rising-edge count: a sustained stretch above threshold is ONE event,
    not one per trial spent there."""
    events, was_high = 0, False
    for d in log.distress_trajectory:
        high = d >= threshold
        if high and not was_high:
            events += 1
        was_high = high
    return events


def engagement_recovery_rate(log: RunLog, threshold: float = 0.6) -> float | None:
    """Of the times an intervention was actually triggered while the child
    was genuinely distressed (true distress >= threshold, not just AURA's
    own estimate of it), what fraction brought them back under threshold?
    `None` (not 0.0) when the condition has no intervention mechanism at
    all — "no mechanism" and "a mechanism that never works" are different
    claims and must stay distinguishable in the results table."""
    relevant = [(before, after) for before, after in log.intervention_episodes if before >= threshold]
    if not relevant:
        return None
    recovered = sum(1 for before, after in relevant if after < threshold)
    return recovered / len(relevant)


def retention_7d(db, child_id: str, topic_id: str) -> float:
    from app.engine.retention_model import RetentionModel

    return RetentionModel(db).current_retention(child_id, topic_id, at=datetime.now(timezone.utc) + timedelta(days=7))


def summarize(log: RunLog, db, child_id: str, topic_id: str, true_best_axes: dict[str, str]) -> dict:
    return {
        "condition": log.condition,
        "child_index": log.child_index,
        "cumulative_regret": round(cumulative_regret(log), 4),
        "sessions_to_decision": sessions_to_decision(log, true_best_axes),
        "trials_to_mastery": trials_to_mastery(log),
        "retention_7d_percent": round(retention_7d(db, child_id, topic_id) * 100, 1),
        "distress_events": distress_events(log),
        "engagement_recovery_rate": engagement_recovery_rate(log),
        "n_trials": len([t for t in log.trials if not t.abandoned and not t.is_intervention]),
        "n_abandoned": sum(1 for t in log.trials if t.abandoned),
    }
