"""
Sanity tests for the Phase 8 research package — NOT a re-run of the full
simulation/ablation studies (those take minutes; see research/results/ for
their actual output). These check the pieces the studies depend on: the
simulator's answering model genuinely differentiates arms, the metric math
is correct against hand-built examples, the ablation engines actually change
behaviour, the baseline policies behave as designed, and the replay harness
finds the right answer on the synthetic example case.

Run from the repo root: backend/.venv/bin/python -m pytest research/tests/ -v
"""
import research  # noqa: F401 — sys.path bootstrap

from research.ablations import ABLATION_ENGINES, NoEarlyPredictorEngine, NoHierarchicalPriorEngine, NoSafetyLayerEngine
from research.baselines import ExpertManualPolicy, HeuristicAdaptivePolicy, StaticPolicy
from research.db import build_db
from research.harness import run_aura_condition
from research.metrics import (
    ActivityRecord,
    RunLog,
    TrialRecord,
    cumulative_regret,
    distress_events,
    engagement_recovery_rate,
    sessions_to_decision,
    trials_to_mastery,
)
from research.replay.harness import replay_file
from research.simulator.child import generate_population


# ---- simulator ----

def test_simulator_favors_the_true_best_arms():
    child = generate_population(1, seed=0)[0]
    matched = child.p_correct(
        method=child.true_best_method, modality=child.true_best_modality, theme=child.true_best_theme,
        mastery=0.3, trial_in_session=0,
    )
    other_method = "errorless" if child.true_best_method != "errorless" else "try_then_correct"
    mismatched = child.p_correct(method=other_method, modality=child.true_best_modality, theme=child.true_best_theme, mastery=0.3, trial_in_session=0)
    assert matched >= mismatched


def test_clone_for_condition_is_independent_of_the_original():
    child = generate_population(1, seed=0)[0]
    child.true_distress = 0.9
    for _ in range(20):
        child.rng.random()  # advance the original's rng

    clone = child.clone_for_condition(seed=123)
    assert clone.true_distress == 0.0
    assert clone.true_best_method == child.true_best_method  # ground truth preserved
    # independent rng streams: a fresh Random(123) should not echo the advanced original
    assert clone.rng.random() != child.rng.random()


# ---- metrics ----

def _toy_log() -> RunLog:
    log = RunLog(condition="toy", child_index=0)
    # trial 0: correct, matched arm (no regret)
    log.trials.append(TrialRecord(activity_index=0, correct=True, optimal_p=0.8, actual_p=0.8, mastery_after=0.5))
    # trial 1: wrong arm used, real regret of 0.3
    log.trials.append(TrialRecord(activity_index=0, correct=False, optimal_p=0.8, actual_p=0.5, mastery_after=0.55))
    # trial 2: mastery crosses 0.8 here
    log.trials.append(TrialRecord(activity_index=1, correct=True, optimal_p=0.9, actual_p=0.9, mastery_after=0.82))
    log.activities = [
        ActivityRecord(activity_index=0, arms={"teaching_method": "errorless", "modality": "tap", "theme": "dino"}),
        ActivityRecord(activity_index=1, arms={"teaching_method": "errorless", "modality": "tap", "theme": "dino"}),
    ]
    log.distress_trajectory = [0.2, 0.65, 0.3]  # one rising-edge crossing of 0.6
    log.intervention_episodes = [(0.65, 0.2)]  # triggered while genuinely distressed, recovered
    return log


def test_cumulative_regret_sums_only_real_shortfall():
    log = _toy_log()
    assert abs(cumulative_regret(log) - 0.3) < 1e-9  # only trial 1 has a gap; abandoned/intervention trials excluded


def test_trials_to_mastery_finds_first_crossing():
    log = _toy_log()
    assert trials_to_mastery(log, threshold=0.8) == 3  # 1-indexed, the 3rd trial


def test_sessions_to_decision_requires_matching_for_the_rest_of_the_run():
    log = _toy_log()
    true_best = {"teaching_method": "errorless", "modality": "tap", "theme": "dino"}
    assert sessions_to_decision(log, true_best) == 0  # matches from activity 0 onward

    log.activities[1] = ActivityRecord(activity_index=1, arms={"teaching_method": "try_then_correct", "modality": "tap", "theme": "dino"})
    assert sessions_to_decision(log, true_best) is None  # never converges for the rest of the run


def test_distress_events_counts_rising_edges_not_every_high_trial():
    log = RunLog(condition="toy", child_index=0)
    log.distress_trajectory = [0.7, 0.8, 0.75, 0.2, 0.9]  # one sustained stretch, then one new spike -> 2 events
    assert distress_events(log, threshold=0.6) == 2


def test_engagement_recovery_rate_distinguishes_no_mechanism_from_zero_percent():
    empty = RunLog(condition="toy", child_index=0)
    assert engagement_recovery_rate(empty) is None  # no mechanism at all

    never_recovers = RunLog(condition="toy", child_index=0)
    never_recovers.intervention_episodes = [(0.7, 0.65), (0.8, 0.75)]
    assert engagement_recovery_rate(never_recovers) == 0.0  # has a mechanism, but it never actually worked

    log = _toy_log()
    assert engagement_recovery_rate(log) == 1.0


# ---- ablations ----

def test_no_hierarchical_prior_actually_flattens_the_prior():
    db = build_db()
    engine = NoHierarchicalPriorEngine(db, random_seed=1)
    assert engine.effects.population_alpha < 0.1
    assert engine.effects.population_beta < 0.1


def test_no_safety_layer_disables_the_distress_threshold():
    db = build_db()
    engine = NoSafetyLayerEngine(db, random_seed=1)
    assert engine.distress.RISING_THRESHOLD == float("inf")


def test_no_early_predictor_redirects_immediate_to_retention(monkeypatch):
    db = build_db()
    engine = NoEarlyPredictorEngine(db, random_seed=1)
    seen_kinds = []
    original = engine.effects.winner

    def spy_winner(child_id, axis_id, arm_ids, kind="immediate"):
        seen_kinds.append(kind)
        return original(child_id, axis_id, arm_ids, kind=kind)

    monkeypatch.setattr(engine.effects, "winner", spy_winner)
    from app.models.experiment import Axis

    axis = db.query(Axis).filter_by(code="teaching_method").one()
    engine.choose_arm("nonexistent-child", axis, distress_level=0.0)  # default outcome_kind="immediate"
    assert seen_kinds == ["retention_7d"]  # ablated: never actually asked for "immediate"

    seen_kinds.clear()
    intervention_axis = db.query(Axis).filter_by(code="intervention").one()
    engine.choose_arm("nonexistent-child", intervention_axis, distress_level=0.0, outcome_kind="engagement_60s")
    assert seen_kinds == ["engagement_60s"]  # untouched: explicit non-"immediate" kinds pass through


def test_all_five_ablation_engines_run_end_to_end():
    child = generate_population(1, seed=2)[0]
    for name, engine_cls in ABLATION_ENGINES.items():
        sim_child = child.clone_for_condition(seed=hash(name) % 10_000)
        log, db, child_id, topic = run_aura_condition(sim_child, condition_name=name, engine_cls=engine_cls, n_activities=3, seed=1)
        assert log.trials, f"{name} produced no trials"


# ---- baselines ----

def test_static_policy_never_changes():
    policy = StaticPolicy()
    first = policy.choose_arms()
    policy.record_outcome(first, correct=False)
    assert policy.choose_arms() == first


def test_heuristic_adaptive_switches_after_a_losing_window():
    policy = HeuristicAdaptivePolicy()
    before = dict(policy.current)
    for _ in range(4):  # WINDOW=4, all wrong
        policy.record_outcome(policy.choose_arms(), correct=False)
    after = policy.choose_arms()
    assert after != before  # at least one axis switched


def test_expert_manual_locks_after_assessment_and_then_freezes():
    policy = ExpertManualPolicy()
    for _ in range(8):  # ASSESSMENT_TRIALS
        arms = policy.choose_arms()
        policy.record_outcome(arms, correct=True)
    locked = policy.choose_arms()
    policy.record_outcome(locked, correct=False)  # should no longer move it
    assert policy.choose_arms() == locked


# ---- replay ----

def test_replay_finds_the_correct_winner_on_the_synthetic_example():
    from pathlib import Path

    csv_path = Path(__file__).resolve().parent.parent / "replay" / "cases" / "example_synthetic_case.csv"
    result = replay_file(csv_path, reference_winner="A")
    assert result["winner"] == "A"
    assert result["agrees_with_reference"] is True
    assert result["session_of_decision"] is not None
    assert result["sessions_saved"] > 0


def test_replay_agrees_with_the_first_real_published_case():
    """Regression test for research/replay/cases/oz_alkoyak_vuran_2025_emre.*
    — a REAL digitized case (Öz-Alkoyak & Vuran, 2025), not synthetic. Pins
    the actual headline finding (research/results/RESULTS.md §4) so a future
    edit to the CSV or the harness can't silently change it without a test
    noticing."""
    from pathlib import Path

    csv_path = Path(__file__).resolve().parent.parent / "replay" / "cases" / "oz_alkoyak_vuran_2025_emre.csv"
    result = replay_file(csv_path, reference_winner="A")
    assert result["winner"] == "A"  # distributed practice — matches the published study's own conclusion
    assert result["agrees_with_reference"] is True
    assert result["session_of_decision"] == 18
    assert result["total_sessions"] == 23
    assert result["sessions_saved"] == 5
