"""
docs/PLAN.md Phase 8, part 1: AURA vs the 5 baselines from README §2's
evaluation plan, over a simulated population.

Run from the repo root:  backend/.venv/bin/python -m research.run_simulation_study

Writes research/results/simulation_results.csv (one row per child per
condition), simulation_summary.md (aggregated table), and two figures.
"""
import csv
import statistics as stats
from collections import Counter, defaultdict
from pathlib import Path

import research  # noqa: F401 — sys.path bootstrap
from research.ablations import ABLATION_ENGINES
from research.baselines import (
    CorrelationalPersonalizationPolicy,
    ExpertManualPolicy,
    HeuristicAdaptivePolicy,
    PopulationLevelPolicy,
    StaticPolicy,
)
from research.baselines.static import DEFAULT_ARMS
from research.harness import run_aura_condition, run_baseline_condition
from research.metrics import regret_curve, summarize
from research.simulator.child import METHOD_ARMS, MODALITY_ARMS, THEME_ARMS, generate_population

RESULTS_DIR = Path(__file__).resolve().parent / "results"
N_EVAL = 24
N_ACTIVITIES = 40
EVAL_SEED = 42

CONDITION_ORDER = ["AURA", "static", "heuristic_adaptive", "correlational", "population_level", "expert_manual"]


def calibrate_population_best(n_calib: int = 10, n_activities: int = 6, calib_seed: int = 777) -> dict[str, str]:
    """Baseline 4: the single fixed combo with the highest average simulated
    accuracy across a calibration population — "run one big population RCT,
    ship the winner to everyone." A fresh calibration population is
    generated per candidate arm (not reused) so no simulated distress/rng
    state leaks between candidates."""
    best = dict(DEFAULT_ARMS)
    axis_arms = {"teaching_method": METHOD_ARMS, "modality": MODALITY_ARMS, "theme": THEME_ARMS}
    for axis, arms in axis_arms.items():
        scores = {}
        for arm in arms:
            combo = {**best, axis: arm}
            children = generate_population(n_calib, seed=calib_seed)
            correct_total, n_total = 0, 0
            for child in children:
                log, _db, _cid, _topic = run_baseline_condition(
                    child, condition_name="calibration", policy=StaticPolicy(combo), n_activities=n_activities
                )
                for t in log.trials:
                    if t.correct is not None:
                        correct_total += int(t.correct)
                        n_total += 1
            scores[arm] = correct_total / n_total if n_total else 0.0
        best[axis] = max(scores, key=scores.get)
    return best


def calibrate_correlational_lookup(n_calib: int = 30, calib_seed: int = 888):
    """Baseline 3: buckets a calibration population by an OBSERVABLE proxy
    (base_ability tercile — stands in for an easily-measured early
    assessment score) and records, per bucket, the population-mode TRUE
    best arm (as if a prior large study had established it for each
    historical child). True best is drawn INDEPENDENTLY of base_ability in
    this simulator (research/simulator/child.py) — deliberately, since
    README §2's whole point is that per-child teaching effects are
    idiosyncratic, not predictable from easy-to-observe traits. So this
    lookup is real and honestly built, but should NOT be expected to beat
    chance at finding any given individual's actual best arm."""
    children = generate_population(n_calib, seed=calib_seed)
    abilities = sorted(c.base_ability for c in children)
    low_cut = abilities[len(abilities) // 3]
    high_cut = abilities[2 * len(abilities) // 3]

    buckets: dict[str, list] = {"low": [], "mid": [], "high": []}
    for c in children:
        buckets[bucket_for(c.base_ability, low_cut, high_cut)].append(c)

    def mode_arm(values):
        return Counter(values).most_common(1)[0][0]

    lookup = {}
    for bucket, members in buckets.items():
        if not members:
            lookup[bucket] = dict(DEFAULT_ARMS)
            continue
        lookup[bucket] = {
            "teaching_method": mode_arm([m.true_best_method for m in members]),
            "modality": mode_arm([m.true_best_modality for m in members]),
            "theme": mode_arm([m.true_best_theme for m in members]),
        }
    return lookup, low_cut, high_cut


def bucket_for(ability: float, low_cut: float, high_cut: float) -> str:
    if ability < low_cut:
        return "low"
    if ability > high_cut:
        return "high"
    return "mid"


def build_condition_runners(population_best: dict, corr_lookup: dict, corr_cuts: tuple[float, float]):
    low_cut, high_cut = corr_cuts

    # Each condition runs against its own CLONE of the child (same ground
    # truth, independent rng + reset distress) — never the shared original,
    # or later conditions in the loop would inherit earlier conditions'
    # leftover rng position and end-of-run distress level.

    def aura(child, seed):
        sim_child = child.clone_for_condition(seed)
        return run_aura_condition(sim_child, condition_name="AURA", engine_cls=ABLATION_ENGINES["full_aura"], n_activities=N_ACTIVITIES, seed=seed)

    def static(child, seed):
        sim_child = child.clone_for_condition(seed)
        return run_baseline_condition(sim_child, condition_name="static", policy=StaticPolicy(), n_activities=N_ACTIVITIES)

    def heuristic(child, seed):
        sim_child = child.clone_for_condition(seed)
        return run_baseline_condition(sim_child, condition_name="heuristic_adaptive", policy=HeuristicAdaptivePolicy(), n_activities=N_ACTIVITIES)

    def correlational(child, seed):
        sim_child = child.clone_for_condition(seed)
        bucket = bucket_for(child.base_ability, low_cut, high_cut)
        return run_baseline_condition(sim_child, condition_name="correlational", policy=CorrelationalPersonalizationPolicy(corr_lookup, bucket), n_activities=N_ACTIVITIES)

    def population(child, seed):
        sim_child = child.clone_for_condition(seed)
        return run_baseline_condition(sim_child, condition_name="population_level", policy=PopulationLevelPolicy(population_best), n_activities=N_ACTIVITIES)

    def expert(child, seed):
        sim_child = child.clone_for_condition(seed)
        return run_baseline_condition(sim_child, condition_name="expert_manual", policy=ExpertManualPolicy(), n_activities=N_ACTIVITIES)

    return {
        "AURA": aura, "static": static, "heuristic_adaptive": heuristic,
        "correlational": correlational, "population_level": population, "expert_manual": expert,
    }


def write_csv(rows: list[dict], path: Path | None = None) -> None:
    path = path or (RESULTS_DIR / "simulation_results.csv")
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def _fmt_mean_sd(values: list) -> str:
    vals = [v for v in values if v is not None]
    if not vals:
        return "n/a"
    if len(vals) == 1:
        return f"{vals[0]:.2f}"
    return f"{stats.mean(vals):.2f} ± {stats.pstdev(vals):.2f}"


def _fmt_convergence(values: list) -> str:
    vals = [v for v in values if v is not None]
    total = len(values)
    if not vals:
        return f"never (0/{total})"
    return f"{stats.mean(vals):.1f} ± {stats.pstdev(vals):.1f} activities ({len(vals)}/{total} converged)"


def write_markdown_summary(rows: list[dict]) -> None:
    by_condition = defaultdict(list)
    for r in rows:
        by_condition[r["condition"]].append(r)

    lines = [
        "| Condition | Cumulative regret ↓ | Activities to mastery ↓ | 7-day retention % ↑ | "
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
        recovery = f"{stats.mean(recovery_vals) * 100:.0f}% (n={len(recovery_vals)})" if recovery_vals else "n/a (no mechanism)"
        lines.append(f"| {condition} | {regret} | {mastery} | {retention} | {decision} | {distress} | {recovery} |")

    (RESULTS_DIR / "simulation_summary.md").write_text("\n".join(lines) + "\n")


def write_figures(regret_curves: dict[str, list[list[float]]]) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    (RESULTS_DIR / "figures").mkdir(exist_ok=True, parents=True)

    fig, ax = plt.subplots(figsize=(8, 5))
    for condition in CONDITION_ORDER:
        curves = regret_curves.get(condition, [])
        if not curves:
            continue
        max_len = max(len(c) for c in curves)
        padded = [c + [c[-1] if c else 0.0] * (max_len - len(c)) for c in curves]
        mean_curve = [stats.mean(vals) for vals in zip(*padded)]
        ax.plot(mean_curve, label=condition)
    ax.set_xlabel("Trial (item answered)")
    ax.set_ylabel("Mean cumulative regret across children")
    ax.set_title("Cumulative regret: AURA vs 5 baselines (simulated population)")
    ax.legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(RESULTS_DIR / "figures" / "regret_curves.png", dpi=150)
    plt.close(fig)


def main():
    print("Calibrating population-level policy (baseline 4)...")
    population_best = calibrate_population_best()
    print(f"  -> {population_best}")

    print("Building correlational lookup (baseline 3)...")
    corr_lookup, low_cut, high_cut = calibrate_correlational_lookup()
    print(f"  -> {corr_lookup} (ability tercile cuts: {low_cut:.3f} / {high_cut:.3f})")

    runners = build_condition_runners(population_best, corr_lookup, (low_cut, high_cut))
    children = generate_population(N_EVAL, seed=EVAL_SEED)

    rows: list[dict] = []
    regret_curves: dict[str, list[list[float]]] = {name: [] for name in runners}
    for child in children:
        true_best_axes = {
            "teaching_method": child.true_best_method, "modality": child.true_best_modality, "theme": child.true_best_theme,
        }
        for name, runner in runners.items():
            log, db, child_id, topic = runner(child, EVAL_SEED * 1000 + child.child_index)
            row = summarize(log, db, child_id, topic, true_best_axes)
            rows.append(row)
            regret_curves[name].append(regret_curve(log))
            print(
                f"  child={child.child_index:02d} condition={name:18s} regret={row['cumulative_regret']:.2f} "
                f"mastery@={row['trials_to_mastery']} retention_7d={row['retention_7d_percent']}% "
                f"decision@={row['sessions_to_decision']} distress_events={row['distress_events']}"
            )

    RESULTS_DIR.mkdir(exist_ok=True)
    write_csv(rows)
    write_markdown_summary(rows)
    write_figures(regret_curves)
    print(f"\nDone. {len(rows)} rows written to {RESULTS_DIR / 'simulation_results.csv'}")


if __name__ == "__main__":
    main()
