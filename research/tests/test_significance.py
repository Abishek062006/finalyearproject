"""
Sanity tests for research/significance.py — hand-built rows with a known
ground truth, not a re-run of the real studies (research/results/*.csv
already has that; run_significance.py analyzes it directly).
"""
import research  # noqa: F401 — sys.path bootstrap

from research.significance import holm_adjust, paired_continuous_test, paired_convergence_test


def _row(condition: str, child_index: int, **metrics) -> dict:
    base = {"trials_to_mastery": "", "sessions_to_decision": ""}
    base.update({k: str(v) for k, v in metrics.items()})
    return {"condition": condition, "child_index": str(child_index), **base}


def test_paired_continuous_detects_a_real_consistent_difference():
    # Condition A beats condition B by ~5 for every child, with a little
    # jitter so the per-pair differences actually have variance (a perfectly
    # constant difference is a degenerate, not "clean", case for a t-test —
    # see the zero-variance test below for that).
    jitter = [0, 1, -1, 2, -2, 0, 1, -1, 2, -2]
    rows = []
    for i in range(10):
        rows.append(_row("A", i, cumulative_regret=10 + i, retention_7d_percent=0, distress_events=0))
        rows.append(_row("B", i, cumulative_regret=15 + i + jitter[i], retention_7d_percent=0, distress_events=0))

    result = paired_continuous_test(rows, "cumulative_regret", "A", "B")
    assert result.n_pairs == 10
    assert result.mean_diff < -4  # consistently negative, close to the designed -5
    assert result.t_pvalue is not None and result.t_pvalue < 0.01
    assert result.wilcoxon_pvalue is not None and result.wilcoxon_pvalue < 0.05
    assert result.cohens_dz is not None and result.cohens_dz < 0  # A consistently lower than B


def test_paired_continuous_handles_zero_variance_gracefully():
    # A and B are IDENTICAL for every child (the real no_safety_layer
    # finding in research/results/significance.md) — must not crash, and
    # must honestly report "no test possible" rather than a fake p-value.
    rows = []
    for i in range(8):
        rows.append(_row("A", i, cumulative_regret=7.5, retention_7d_percent=90, distress_events=1))
        rows.append(_row("B", i, cumulative_regret=7.5, retention_7d_percent=90, distress_events=1))

    result = paired_continuous_test(rows, "cumulative_regret", "A", "B")
    assert result.n_pairs == 8
    assert result.mean_diff == 0.0
    assert result.cohens_dz is None
    assert result.t_pvalue is None
    assert result.wilcoxon_pvalue is None


def test_paired_continuous_only_uses_children_present_in_both_conditions():
    rows = [
        _row("A", 0, cumulative_regret=1, retention_7d_percent=0, distress_events=0),
        _row("A", 1, cumulative_regret=2, retention_7d_percent=0, distress_events=0),
        _row("B", 0, cumulative_regret=1, retention_7d_percent=0, distress_events=0),
        # child 1 never ran condition B — must be excluded, not treated as 0
        _row("B", 2, cumulative_regret=9, retention_7d_percent=0, distress_events=0),
    ]
    # Only child 0 ran both A and B — a single pair isn't enough for any of
    # these tests to mean anything, so the function declines to run one.
    assert paired_continuous_test(rows, "cumulative_regret", "A", "B") is None


def test_paired_continuous_returns_none_below_two_pairs():
    rows = [
        _row("A", 0, cumulative_regret=1, retention_7d_percent=0, distress_events=0),
        _row("B", 0, cumulative_regret=1, retention_7d_percent=0, distress_events=0),
    ]
    assert paired_continuous_test(rows, "cumulative_regret", "A", "B") is None  # only 1 pair — too few to test
    assert paired_continuous_test([], "cumulative_regret", "A", "B") is None


def test_mcnemar_favors_the_side_with_more_wins_and_is_significant_when_lopsided():
    rows = []
    # 10 children: A converges, B doesn't, every single time.
    for i in range(10):
        rows.append(_row("A", i, trials_to_mastery=5))
        rows.append(_row("B", i, trials_to_mastery=""))

    result = paired_convergence_test(rows, "trials_to_mastery", "A", "B")
    assert result.n_pairs == 10
    assert result.rate_a == 1.0
    assert result.rate_b == 0.0
    assert result.n_discordant == 10
    assert result.mcnemar_pvalue is not None and result.mcnemar_pvalue < 0.01


def test_mcnemar_has_no_p_value_when_there_are_no_discordant_pairs():
    rows = [_row("A", i, trials_to_mastery=5) for i in range(6)] + [_row("B", i, trials_to_mastery=5) for i in range(6)]
    result = paired_convergence_test(rows, "trials_to_mastery", "A", "B")
    assert result.n_discordant == 0
    assert result.mcnemar_pvalue is None


def test_holm_adjust_matches_hand_computed_example():
    # Standard worked example: ascending p-values [0.01, 0.02, 0.03, 0.04],
    # m=4 -> multipliers [4,3,2,1] -> running max -> [0.04, 0.06, 0.06, 0.06]
    adjusted = holm_adjust([0.01, 0.02, 0.03, 0.04])
    assert adjusted == [0.04, 0.06, 0.06, 0.06]


def test_holm_adjust_caps_at_one_and_passes_none_through():
    adjusted = holm_adjust([0.9, None, 0.8])
    assert adjusted[1] is None
    assert all(0 <= p <= 1.0 for p in adjusted if p is not None)


def test_holm_adjust_is_order_preserving_not_just_value_preserving():
    # Deliberately NOT pre-sorted input — output must line up with input
    # order, not the internally-sorted order.
    adjusted = holm_adjust([0.04, 0.01, 0.03, 0.02])
    assert adjusted == [0.06, 0.04, 0.06, 0.06]
