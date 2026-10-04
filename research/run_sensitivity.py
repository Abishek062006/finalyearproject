"""
Does AURA's advantage depend on how we built the simulated children?
Re-runs the comparison with (a) every child's method, mode and theme effects
scaled to 0.5x and 2x, (b) distress proneness doubled, and (c) five named
SYNTHETIC ARCHETYPES plus a mixed population of all of them. AURA is compared
with the static app and the strongest baseline (heuristic adaptive), same
children, same seeds, paired tests.

The archetypes are illustrative parameter settings written by us from commonly
described patterns (children who find mistakes upsetting, who learn slowly,
who respond strongly to one way of working, who have no clear preference).
They are NOT derived from data on real children and are not evidence about
real autistic children; they only show that the result does not hinge on one
kind of simulated child.

    backend/.venv/bin/python -m research.run_sensitivity

Writes research/results/sensitivity.md and sensitivity.csv.
"""
import csv
import statistics
from pathlib import Path

from scipy import stats

import research  # noqa: F401 — sys.path bootstrap
from research.ablations import ABLATION_ENGINES
from research.baselines.heuristic import HeuristicAdaptivePolicy
from research.baselines.static import StaticPolicy
from research.harness import run_aura_condition, run_baseline_condition
from research.metrics import summarize
from research.simulator.child import generate_population

N = 40
ACTIVITIES = 40
SEED = 44
# Multipliers on the generated children's parameters (1.0 = unchanged).
ARCHETYPES = {
    "archetype: finds mistakes upsetting": {"distress": 2.5, "ability": 0.9},
    "archetype: slow, steady learner": {"learning": 0.5, "ability": 0.85},
    "archetype: one strongly preferred way of working": {"mode": 2.5, "method": 2.0, "theme": 0.0},
    "archetype: no clear preferences": {"effects": 0.25},
    "archetype: capable but very easily overloaded": {"ability": 1.15, "distress": 3.0},
}
SCENARIOS = {
    "weak preferences (effects x0.5)": {"effects": 0.5},
    "as in the main study (x1)": {},
    "strong preferences (effects x2)": {"effects": 2.0},
    "easily upset children (distress x2)": {"distress": 2.0},
    **ARCHETYPES,
    "mixed population of the five archetypes": "mixed",
}
RESULTS = Path(__file__).parent / "results"


def _apply(c, cfg: dict) -> None:
    e = cfg.get("effects", 1.0)
    c.method_effect *= e * cfg.get("method", 1.0)
    c.modality_effect *= e * cfg.get("mode", 1.0)
    c.theme_effect *= e * cfg.get("theme", 1.0)
    c.distress_proneness = min(1.0, c.distress_proneness * cfg.get("distress", 1.0))
    c.learning_rate *= cfg.get("learning", 1.0)
    c.base_ability = min(0.9, c.base_ability * cfg.get("ability", 1.0))


def population(cfg):
    kids = generate_population(N, seed=SEED)
    archetypes = list(ARCHETYPES.values())
    for c in kids:
        _apply(c, archetypes[c.child_index % len(archetypes)] if cfg == "mixed" else cfg)
    return kids


def main() -> None:
    rows = []
    for name, cfg in SCENARIOS.items():
        for child in population(cfg):
            seed = SEED * 1000 + child.child_index
            truth = {"teaching_method": child.true_best_method, "modality": child.true_best_modality, "theme": child.true_best_theme}
            runs = {
                "AURA": lambda c, s: run_aura_condition(c.clone_for_condition(s), condition_name="AURA", engine_cls=ABLATION_ENGINES["full_aura"], n_activities=ACTIVITIES, seed=s),
                "static": lambda c, s: run_baseline_condition(c.clone_for_condition(s), condition_name="static", policy=StaticPolicy(), n_activities=ACTIVITIES),
                "heuristic": lambda c, s: run_baseline_condition(c.clone_for_condition(s), condition_name="heuristic", policy=HeuristicAdaptivePolicy(), n_activities=ACTIVITIES),
            }
            for cond, run in runs.items():
                log, db, cid, topic = run(child, seed)
                m = summarize(log, db, cid, topic, truth)
                rows.append({"scenario": name, "condition": cond, "child": child.child_index, "regret": m["cumulative_regret"], "retention": m["retention_7d_percent"], "distress_events": m["distress_events"]})
        print("done:", name, flush=True)

    RESULTS.mkdir(exist_ok=True)
    with open(RESULTS / "sensitivity.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)

    lines = [
        "# Sensitivity of AURA's advantage to the simulated children (research/run_sensitivity.py)",
        "",
        f"N = {N} children per scenario, {ACTIVITIES} activities, paired (each child faces every system as an identical clone). Mean cumulative regret (lower is better); p = paired Wilcoxon signed-rank for AURA vs that system.",
        "",
        "| Scenario | AURA regret | Static regret (p) | Heuristic regret (p) | AURA retention % | Static % | Heuristic % | AURA distress events | Static | Heuristic |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for name in SCENARIOS:
        def col(cond, key):
            return [r[key] for r in sorted((r for r in rows if r["scenario"] == name and r["condition"] == cond), key=lambda r: r["child"])]

        def p(cond):
            a, b = col("AURA", "regret"), col(cond, "regret")
            return stats.wilcoxon(a, b).pvalue if any(x != y for x, y in zip(a, b)) else 1.0

        mean = lambda cond, key: statistics.mean(col(cond, key))
        fp = lambda x: "<0.001" if x < 0.001 else f"{x:.3f}"
        lines.append(
            f"| {name} | {mean('AURA','regret'):.2f} | {mean('static','regret'):.2f} ({fp(p('static'))}) | {mean('heuristic','regret'):.2f} ({fp(p('heuristic'))}) | "
            f"{mean('AURA','retention'):.1f} | {mean('static','retention'):.1f} | {mean('heuristic','retention'):.1f} | "
            f"{mean('AURA','distress_events'):.2f} | {mean('static','distress_events'):.2f} | {mean('heuristic','distress_events'):.2f} |"
        )
    (RESULTS / "sensitivity.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
