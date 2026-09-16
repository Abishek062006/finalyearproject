"""
docs/PLAN.md Phase 8 follow-up: paired significance testing on top of the
simulation and ablation studies' already-collected results.

Run from the repo root:  backend/.venv/bin/python -m research.run_significance

Reads the EXISTING research/results/simulation_results.csv and
ablation_results.csv (does not re-run either study — they take minutes;
this takes under a second) and writes research/results/significance.md.
"""
from pathlib import Path

import research  # noqa: F401 — sys.path bootstrap
from research.significance import (
    CONTINUOUS_METRICS,
    CONVERGENCE_METRICS,
    holm_adjust,
    load_rows,
    paired_continuous_test,
    paired_convergence_test,
)

RESULTS_DIR = Path(__file__).resolve().parent / "results"

METRIC_LABELS = {
    "cumulative_regret": "Cumulative regret (lower is better)",
    "retention_7d_percent": "7-day retention % (higher is better)",
    "distress_events": "Distress events (lower is better)",
    "trials_to_mastery": "Reached 80% mastery within the study horizon",
    "sessions_to_decision": "Reached, and kept, the correct decision within the study horizon",
}

SIM_CONDITIONS = ["static", "heuristic_adaptive", "correlational", "population_level", "expert_manual"]
ABLATION_CONDITIONS = ["no_hierarchical_prior", "no_early_predictor", "no_safety_layer", "no_randomization"]
ALPHA = 0.05


def _fmt(x: float | None, digits: int = 4) -> str:
    return f"{x:.{digits}f}" if x is not None else "n/a"


def analyze(csv_path: Path, reference: str, others: list[str], label: str) -> str:
    rows = load_rows(csv_path)
    lines = [f"## {label}: {reference} vs. each condition\n"]

    for metric in CONTINUOUS_METRICS:
        lines.append(f"**{METRIC_LABELS[metric]}** — paired t-test and Wilcoxon signed-rank, Holm-adjusted across these {len(others)} comparisons.\n")
        lines.append(f"| vs {reference} | n pairs | mean ({reference}) | mean (other) | mean diff | Cohen's d_z | t-test p | Holm-adjusted | Wilcoxon p | Holm-adjusted |")
        lines.append("|---|---|---|---|---|---|---|---|---|---|")
        results = [paired_continuous_test(rows, metric, reference, other) for other in others]
        t_adj = holm_adjust([r.t_pvalue if r else None for r in results])
        w_adj = holm_adjust([r.wilcoxon_pvalue if r else None for r in results])
        for other, r, tpa, wpa in zip(others, results, t_adj, w_adj):
            if r is None:
                lines.append(f"| {other} | 0 pairs with data | - | - | - | - | - | - | - | - |")
                continue
            sig = " **significant**" if tpa is not None and tpa < ALPHA else ""
            lines.append(
                f"| {other} | {r.n_pairs} | {r.mean_a:.2f} | {r.mean_b:.2f} | {r.mean_diff:+.2f} | "
                f"{_fmt(r.cohens_dz, 2)} | {_fmt(r.t_pvalue)} | {_fmt(tpa)}{sig} | {_fmt(r.wilcoxon_pvalue)} | {_fmt(wpa)} |"
            )
        lines.append("")

    for metric in CONVERGENCE_METRICS:
        lines.append(f"**{METRIC_LABELS[metric]}** — exact McNemar test on paired yes/no outcomes, Holm-adjusted.\n")
        lines.append(f"| vs {reference} | n pairs | rate ({reference}) | rate (other) | discordant pairs | McNemar p | Holm-adjusted |")
        lines.append("|---|---|---|---|---|---|---|")
        results = [paired_convergence_test(rows, metric, reference, other) for other in others]
        adj = holm_adjust([r.mcnemar_pvalue if r else None for r in results])
        for other, r, pa in zip(others, results, adj):
            if r is None:
                lines.append(f"| {other} | 0 | - | - | - | - | - |")
                continue
            p_display = _fmt(r.mcnemar_pvalue) if r.n_discordant > 0 else "n/a (identical outcomes — no discordant pairs)"
            sig = " **significant**" if pa is not None and pa < ALPHA else ""
            lines.append(f"| {other} | {r.n_pairs} | {r.rate_a * 100:.0f}% | {r.rate_b * 100:.0f}% | {r.n_discordant} | {p_display} | {_fmt(pa)}{sig} |")
        lines.append("")

    return "\n".join(lines)


def main():
    out = [
        "# Paired significance testing",
        "",
        "Mechanically generated from `simulation_results.csv` / `ablation_results.csv` "
        "(re-run `research/run_significance.py` any time those change — it takes under a "
        "second, it does not re-run either study). See `RESULTS.md` for the narrative "
        "read of these numbers, including why a real-looking descriptive gap not "
        "reaching significance at this sample size is expected, not a failure.",
        "",
        "Every test here is PAIRED — each simulated child faced every condition as a "
        "clone of the same ground truth under the same random seed (common random "
        "numbers), so a per-child difference genuinely isolates the effect of the "
        "condition, not noise from comparing different children. p-values are "
        "Holm-Bonferroni adjusted within each metric's family of comparisons (5 "
        "baselines, or 4 ablations) to control the false-positive rate across that "
        "many tests — use the adjusted column to decide significance, not the raw one.",
        "",
    ]
    out.append(analyze(RESULTS_DIR / "simulation_results.csv", "AURA", SIM_CONDITIONS, "Simulation study"))
    out.append(analyze(RESULTS_DIR / "ablation_results.csv", "full_aura", ABLATION_CONDITIONS, "Ablation study"))

    path = RESULTS_DIR / "significance.md"
    path.write_text("\n".join(out) + "\n")
    print(f"Written to {path}")


if __name__ == "__main__":
    main()
