"""
The replay study (docs/PLAN.md Phase 8, part 3 / README §4 "Filling the
gap"): digitize a session-by-session graph from a published single-case
study, replay the points through AURA's OWN stopping rule as if they had
arrived one session at a time, and ask "would AURA have reached the same
verdict, and how much earlier than the full published study length?"

This module is honest about what it is: a REPLAY of already-published,
already-decided results, not a new randomized experiment — it can show that
AURA's rule is CONSISTENT with expert-reached verdicts and often reaches them
sooner, not that AURA discovered anything new. See replay/README.md for why
no real published data ships here.

The estimator below is a deliberately small, self-contained Beta-Binomial
posterior + non-overlapping-CI stopping rule — the SAME statistical logic as
app/engine/effect_estimator.py (same constants), reimplemented standalone
here because replayed points come from a CSV, not the app's own database
schema (a digitized graph has no child_id, axis_id, or Assignment rows to
attach to).
"""
import csv
from dataclasses import dataclass
from pathlib import Path

POPULATION_ALPHA = 2.0
POPULATION_BETA = 2.0
MIN_EVIDENCE_TRIALS = 8  # matches app/engine/effect_estimator.py exactly


@dataclass
class ReplayPoint:
    session: int
    condition: str
    value: float  # 0..1 (accuracy / success proportion for that session)
    n: int = 1  # trials that session's value is based on, if known (default: one Bernoulli-style observation)


@dataclass
class ReplayVerdict:
    session_of_decision: int | None  # first session index a confirmed winner appeared, or None
    winner: str | None
    total_sessions: int
    sessions_saved: int | None  # total_sessions - session_of_decision, if a verdict was reached


def load_case(csv_path: str | Path) -> list[ReplayPoint]:
    """CSV columns: session (int), condition (str), value (0..1), n (int, optional -> 1)."""
    points = []
    with open(csv_path, newline="") as f:
        for row in csv.DictReader(f):
            points.append(
                ReplayPoint(
                    session=int(row["session"]),
                    condition=row["condition"].strip(),
                    value=float(row["value"]),
                    n=int(row["n"]) if row.get("n") else 1,
                )
            )
    return sorted(points, key=lambda p: p.session)


def _posterior(alpha: float, beta: float) -> tuple[float, float, float]:
    mean = alpha / (alpha + beta)
    sd = ((alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1))) ** 0.5
    return mean, max(0.0, mean - 1.96 * sd), min(1.0, mean + 1.96 * sd)


def replay_case(points: list[ReplayPoint], reference_winner: str | None = None) -> ReplayVerdict:
    """Feeds points in session order, exactly like they'd arrive in a real
    ongoing comparison, and re-checks AURA's own stopping rule
    (MIN_EVIDENCE_TRIALS + non-overlapping 95% CI, app/engine/
    effect_estimator.py's `winner()`) after every new session."""
    conditions = sorted({p.condition for p in points})
    alpha = {c: POPULATION_ALPHA for c in conditions}
    beta = {c: POPULATION_BETA for c in conditions}
    n_trials = {c: 0 for c in conditions}

    sessions = sorted({p.session for p in points})
    for session in sessions:
        for p in [pt for pt in points if pt.session == session]:
            successes = p.value * p.n
            alpha[p.condition] += successes
            beta[p.condition] += p.n - successes
            n_trials[p.condition] += p.n

        posteriors = {c: _posterior(alpha[c], beta[c]) for c in conditions}
        ranked = sorted(conditions, key=lambda c: posteriors[c][0], reverse=True)
        best = ranked[0]
        if n_trials[best] < MIN_EVIDENCE_TRIALS:
            continue
        if len(ranked) > 1:
            runner_up = ranked[1]
            if posteriors[runner_up][2] >= posteriors[best][1]:
                continue  # still statistically indistinguishable
        return ReplayVerdict(
            session_of_decision=session, winner=best, total_sessions=len(sessions),
            sessions_saved=len(sessions) - session,
        )

    return ReplayVerdict(session_of_decision=None, winner=None, total_sessions=len(sessions), sessions_saved=None)


def replay_file(csv_path: str | Path, reference_winner: str | None = None) -> dict:
    points = load_case(csv_path)
    verdict = replay_case(points, reference_winner=reference_winner)
    result = {
        "case": str(csv_path),
        "total_sessions": verdict.total_sessions,
        "session_of_decision": verdict.session_of_decision,
        "winner": verdict.winner,
        "sessions_saved": verdict.sessions_saved,
    }
    if reference_winner is not None:
        result["reference_winner"] = reference_winner
        result["agrees_with_reference"] = verdict.winner == reference_winner
    return result


if __name__ == "__main__":
    import sys

    path = sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parent / "example_synthetic_case.csv"
    ref = sys.argv[2] if len(sys.argv) > 2 else None
    print(replay_file(path, reference_winner=ref))
