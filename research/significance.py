"""
Paired significance testing on top of the simulation and ablation studies
(docs/PLAN.md Phase 8's "not yet done" follow-up: "paired significance
testing on top of the two result tables — the common-random-numbers paired
design already in place makes this cheap to add").

Every condition in both studies runs against a CLONE of the SAME simulated
child per child_index (research/simulator/child.py's clone_for_condition,
same seed across conditions — a common-random-numbers design). That means
AURA vs any one baseline (or full_aura vs any one ablation) is a genuinely
PAIRED comparison: child 7 under AURA and child 7 under `static` faced
identical underlying ground truth and the same random draws wherever the
policies happened to make the same choice. Paired tests (which look at the
per-child DIFFERENCE) are the statistically appropriate — and much more
powerful — choice here, not an independent-samples test.

Two kinds of outcome need two different tests:
  - Continuous/count metrics that are always defined (cumulative_regret,
    retention_7d_percent, distress_events): paired t-test AND Wilcoxon
    signed-rank (the latter doesn't assume normally-distributed
    differences, which regret in particular is unlikely to be).
  - "Did it converge at all" metrics that are sometimes undefined
    (trials_to_mastery, sessions_to_decision — None means "never" within
    the study's horizon): exact McNemar's test on paired yes/no outcomes,
    since a plain t-test on values that are sometimes missing (censored)
    is not appropriate.

With N=24 (simulation study) and N=16 (ablation study), statistical power
is genuinely limited — several comparisons will likely NOT reach
significance despite a real-looking descriptive gap. That is reported
honestly, not papered over (see research/results/RESULTS.md's own
"Honesty note" for the same reason from the studies themselves).
"""
import csv
import math
from dataclasses import dataclass
from pathlib import Path

from scipy import stats

CONTINUOUS_METRICS = ["cumulative_regret", "retention_7d_percent", "distress_events"]
CONVERGENCE_METRICS = ["trials_to_mastery", "sessions_to_decision"]


@dataclass
class PairedContinuousResult:
    metric: str
    condition_a: str
    condition_b: str
    n_pairs: int
    mean_a: float
    mean_b: float
    mean_diff: float  # a - b
    cohens_dz: float | None  # paired effect size: mean(diff) / sd(diff)
    t_stat: float | None
    t_pvalue: float | None
    wilcoxon_stat: float | None
    wilcoxon_pvalue: float | None


@dataclass
class PairedConvergenceResult:
    metric: str
    condition_a: str
    condition_b: str
    n_pairs: int
    rate_a: float  # fraction of pairs where condition_a converged
    rate_b: float
    n_discordant: int  # pairs where exactly one of the two converged — this is all McNemar looks at
    mcnemar_pvalue: float | None


def load_rows(csv_path: str | Path) -> list[dict]:
    with open(csv_path, newline="") as f:
        return list(csv.DictReader(f))


def _pivot_continuous(rows: list[dict], metric: str, condition_a: str, condition_b: str) -> tuple[list[float], list[float]]:
    a_vals, b_vals = {}, {}
    for r in rows:
        if r[metric] == "":
            continue
        if r["condition"] == condition_a:
            a_vals[r["child_index"]] = float(r[metric])
        elif r["condition"] == condition_b:
            b_vals[r["child_index"]] = float(r[metric])
    common = sorted(set(a_vals) & set(b_vals), key=int)
    return [a_vals[c] for c in common], [b_vals[c] for c in common]


def _pivot_convergence(rows: list[dict], metric: str, condition_a: str, condition_b: str) -> tuple[list[bool], list[bool]]:
    a_vals, b_vals = {}, {}
    for r in rows:
        if r["condition"] == condition_a:
            a_vals[r["child_index"]] = r[metric] != ""
        elif r["condition"] == condition_b:
            b_vals[r["child_index"]] = r[metric] != ""
    common = sorted(set(a_vals) & set(b_vals), key=int)
    return [a_vals[c] for c in common], [b_vals[c] for c in common]


def paired_continuous_test(rows: list[dict], metric: str, condition_a: str, condition_b: str) -> PairedContinuousResult | None:
    a, b = _pivot_continuous(rows, metric, condition_a, condition_b)
    n = len(a)
    if n < 2:
        return None

    diffs = [x - y for x, y in zip(a, b)]
    mean_diff = sum(diffs) / n
    sd_diff = math.sqrt(sum((d - mean_diff) ** 2 for d in diffs) / (n - 1)) if n > 1 else 0.0
    cohens_dz = (mean_diff / sd_diff) if sd_diff > 0 else None

    t_stat = t_p = None
    if sd_diff > 0:
        t_res = stats.ttest_rel(a, b)
        t_stat, t_p = float(t_res.statistic), float(t_res.pvalue)

    w_stat = w_p = None
    if any(d != 0 for d in diffs):
        try:
            w_res = stats.wilcoxon(a, b)
            w_stat, w_p = float(w_res.statistic), float(w_res.pvalue)
        except ValueError:
            pass  # e.g. too few non-zero differences for scipy's exact method

    return PairedContinuousResult(
        metric=metric, condition_a=condition_a, condition_b=condition_b, n_pairs=n,
        mean_a=sum(a) / n, mean_b=sum(b) / n, mean_diff=mean_diff, cohens_dz=cohens_dz,
        t_stat=t_stat, t_pvalue=t_p, wilcoxon_stat=w_stat, wilcoxon_pvalue=w_p,
    )


def paired_convergence_test(rows: list[dict], metric: str, condition_a: str, condition_b: str) -> PairedConvergenceResult | None:
    a, b = _pivot_convergence(rows, metric, condition_a, condition_b)
    n = len(a)
    if n == 0:
        return None

    only_a = sum(1 for x, y in zip(a, b) if x and not y)
    only_b = sum(1 for x, y in zip(a, b) if y and not x)
    n_discordant = only_a + only_b

    p = None
    if n_discordant > 0:
        # Exact McNemar test: under the null, the smaller discordant count is
        # Binomial(n_discordant, 0.5) — the right test at these small sample
        # sizes rather than the chi-square approximation.
        p = float(stats.binomtest(min(only_a, only_b), n_discordant, 0.5, alternative="two-sided").pvalue)

    return PairedConvergenceResult(
        metric=metric, condition_a=condition_a, condition_b=condition_b, n_pairs=n,
        rate_a=sum(a) / n, rate_b=sum(b) / n, n_discordant=n_discordant, mcnemar_pvalue=p,
    )


def holm_adjust(pvalues: list[float | None]) -> list[float | None]:
    """Holm-Bonferroni step-down correction — controls the family-wise error
    rate across a family of comparisons (here: one metric tested against
    every baseline/ablation) without being as conservative as plain
    Bonferroni. `None` entries (a test that couldn't be run) pass through
    unchanged and are excluded from the correction's m count."""
    indexed = [(i, p) for i, p in enumerate(pvalues) if p is not None]
    m = len(indexed)
    ranked = sorted(indexed, key=lambda pair: pair[1])
    adjusted = [None] * len(pvalues)
    running_max = 0.0
    for rank, (i, p) in enumerate(ranked):
        candidate = min(1.0, p * (m - rank))
        running_max = max(running_max, candidate)
        adjusted[i] = running_max
    return adjusted
