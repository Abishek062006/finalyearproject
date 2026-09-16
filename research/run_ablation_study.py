"""
docs/PLAN.md Phase 8, part 2: the ablation table — full AURA vs each of its
own 4 design choices removed one at a time (research/ablations.py):
hierarchical prior, early predictor, safety layer, randomization.

Run from the repo root:  backend/.venv/bin/python -m research.run_ablation_study

Writes research/results/ablation_results.csv and ablation_summary.md, using
the SAME simulated population and metrics as the baseline comparison so the
two tables are directly comparable.
"""
import statistics as stats
from collections import defaultdict
from pathlib import Path

import research  # noqa: F401 — sys.path bootstrap
from research.ablations import ABLATION_ENGINES
from research.harness import run_aura_condition
from research.metrics import summarize
from research.run_simulation_study import _fmt_convergence, _fmt_mean_sd, write_csv as _write_csv
from research.simulator.child import generate_population

RESULTS_DIR = Path(__file__).resolve().parent / "results"
N_EVAL = 48  # bumped from 16 (docs/PLAN.md Phase 8 follow-up — see run_simulation_study.py's
# N_EVAL comment: same determinism argument, child 0..15 here are identical to the original run)
N_ACTIVITIES = 60  # more room than the baseline study: no_early_predictor needs several 7-day probe cycles to have any chance
EVAL_SEED = 43

CONDITION_ORDER = ["full_aura", "no_hierarchical_prior", "no_early_predictor", "no_safety_layer", "no_randomization"]


def write_markdown_summary(rows: list[dict]) -> None:
    by_condition = defaultdict(list)
    for r in rows:
        by_condition[r["condition"]].append(r)

    lines = [
        "| Ablation | Cumulative regret ↓ | Activities to mastery ↓ | 7-day retention % ↑ | "
        "Activities to correct decision ↓ | Distress events ↓ | Engagement recovery % ↑ |",
        "|---|---|---|---|---|---|---|",
    ]
    for condition in CONDITION_ORDER:
        condition_rows = by_condition.get(condition, [])
        if not condition_rows:
            continue
        regret = _fmt_mean_sd([r["cumulative_regret"] for r in condition_rows])
        mastery = _fmt_convergence([r["trials_to_mastery"] for r in condition_rows])
        retention = _fmt_mean_sd([r["retention_7d_percent"] for r in condition_rows])
        decision = _fmt_convergence([r["sessions_to_decision"] for r in condition_rows])
        distress = _fmt_mean_sd([r["distress_events"] for r in condition_rows])
        recovery_vals = [r["engagement_recovery_rate"] for r in condition_rows if r["engagement_recovery_rate"] is not None]
        recovery = f"{stats.mean(recovery_vals) * 100:.0f}% (n={len(recovery_vals)})" if recovery_vals else "n/a"
        lines.append(f"| {condition} | {regret} | {mastery} | {retention} | {decision} | {distress} | {recovery} |")

    (RESULTS_DIR / "ablation_summary.md").write_text("\n".join(lines) + "\n")


def main():
    children = generate_population(N_EVAL, seed=EVAL_SEED)
    rows: list[dict] = []

    for child in children:
        true_best_axes = {
            "teaching_method": child.true_best_method, "modality": child.true_best_modality, "theme": child.true_best_theme,
        }
        seed = EVAL_SEED * 1000 + child.child_index
        for condition, engine_cls in ABLATION_ENGINES.items():
            sim_child = child.clone_for_condition(seed)
            log, db, child_id, topic = run_aura_condition(
                sim_child, condition_name=condition, engine_cls=engine_cls, n_activities=N_ACTIVITIES, seed=seed
            )
            row = summarize(log, db, child_id, topic, true_best_axes)
            rows.append(row)
            print(
                f"  child={child.child_index:02d} ablation={condition:22s} regret={row['cumulative_regret']:.2f} "
                f"mastery@={row['trials_to_mastery']} retention_7d={row['retention_7d_percent']}% "
                f"decision@={row['sessions_to_decision']} distress_events={row['distress_events']}"
            )

    RESULTS_DIR.mkdir(exist_ok=True)
    _write_csv(rows, RESULTS_DIR / "ablation_results.csv")
    write_markdown_summary(rows)
    print(f"\nDone. {len(rows)} rows written to {RESULTS_DIR / 'ablation_results.csv'}")


if __name__ == "__main__":
    main()
