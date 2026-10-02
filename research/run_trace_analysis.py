"""
Per-decision trace analysis for the paper's Section IV-C/D/E (how adaptation
actually unfolds over time), complementing the end-of-run summaries of
run_simulation_study.py.

Same population and seed as the simulation study (N=80, EVAL_SEED=42, 40
activities), same REAL production DecisionEngine, same harness mechanics —
but every activity is logged: which arm each axis chose, whether that was an
explore/exploit/safe-fallback decision, the difficulty emitted, and, for
interventions, which one fired and how distress changed around it. A static
baseline is run on the same children for the engagement comparison.

    backend/.venv/bin/python -m research.run_trace_analysis

Writes research/results/trace_*.csv, trace_summary.md and figures/trace_*.png.
"""
import csv
import statistics
from collections import Counter, defaultdict
from pathlib import Path

import research  # noqa: F401 — sys.path bootstrap
from research.ablations import ABLATION_ENGINES
from research.baselines.static import StaticPolicy
from research.db import build_db, register_child, topic_id as get_topic_id
from research.harness import ACTIVITIES_PER_SESSION, _force_due_probes, _tag_new_probes, run_baseline_condition
from research.simulator.child import generate_population

from app.engine.learner_model import LearnerModel
from app.services import educator_service, session_service

N_EVAL = 80
N_ACTIVITIES = 40
EVAL_SEED = 42
DISTRESS_THRESHOLD = 0.6
AXES = ("teaching_method", "modality", "theme")
RESULTS = Path(__file__).parent / "results"


def trace_aura(child, seed: int) -> list[dict]:
    """run_aura_condition's loop, recording every decision it makes."""
    db = build_db()
    child_id = register_child(db, nickname=f"child{child.child_index}")
    topic = get_topic_id(db)
    educator_service.assign_topic(db, child_id, topic_code="num_1_5", user_id="research-trace")
    learner = LearnerModel(db)
    engine = ABLATION_ENGINES["full_aura"](db, random_seed=seed)
    scheduled: dict[str, int] = {}
    rows: list[dict] = []
    sim_day = done = 0

    while done < N_ACTIVITIES:
        session = session_service.start_session(db, child_id)
        child.reset_daily_distress()
        sim_day += 1
        _force_due_probes(db, child_id, sim_day, scheduled)
        trial_in_session = 0
        for _ in range(ACTIVITIES_PER_SESSION):
            if done >= N_ACTIVITIES:
                break
            activity = session_service.next_activity(db, session.id, engine=engine)
            spec = activity.spec
            row = {"child": child.child_index, "activity": done, "is_intervention": spec["is_intervention"], "difficulty": spec["difficulty"]}

            if spec["is_intervention"]:
                before = child.true_distress
                child.apply_intervention_relief(spec.get("intervention_type"))
                session_service.record_answer(db, activity.id, item_id=None, correct=True, response_time_ms=1000)
                row.update(intervention=spec.get("intervention_type"), distress_before=before, distress_after=child.true_distress,
                           intervention_is_best=spec.get("intervention_type") == child.true_best_intervention)
                rows.append(row)
                done += 1
                continue

            arms = {"teaching_method": spec["method"], "modality": spec["modality"], "theme": spec["theme"]}
            truth = {"teaching_method": child.true_best_method, "modality": child.true_best_modality, "theme": child.true_best_theme}
            for axis in AXES:
                row[f"{axis}"] = arms[axis]
                row[f"{axis}_correct"] = arms[axis] == truth[axis]
                row[f"{axis}_decision"] = spec["decision_types"].get(axis)

            correct_n = answered = 0
            abandoned = False
            for item in spec["items"]:
                mastery = learner.get_mastery(child_id, topic).p
                if child.should_abandon():
                    abandoned = True
                    break
                correct, rt = child.answer(method=arms["teaching_method"], modality=arms["modality"], theme=arms["theme"], mastery=mastery, trial_in_session=trial_in_session)
                session_service.record_answer(db, activity.id, item_id=item["id"], correct=correct, response_time_ms=rt)
                child.update_distress(correct=correct, method=arms["teaching_method"], modality=arms["modality"], theme=arms["theme"])
                _tag_new_probes(db, child_id, sim_day, scheduled)
                correct_n += int(correct)
                answered += 1
                trial_in_session += 1
            row.update(accuracy=(correct_n / answered) if answered else None, abandoned=abandoned,
                       mastery=learner.get_mastery(child_id, topic).p, distress=child.true_distress)
            rows.append(row)
            done += 1
            if abandoned:
                break
        session_service.end_session(db, session.id)
    return rows


def static_distress_by_activity(children) -> dict[int, list[float]]:
    out: dict[int, list[float]] = defaultdict(list)
    for child in children:
        seed = EVAL_SEED * 1000 + child.child_index
        log, *_ = run_baseline_condition(child.clone_for_condition(seed), condition_name="static", policy=StaticPolicy(), n_activities=N_ACTIVITIES)
        per_activity: dict[int, list[float]] = defaultdict(list)
        for t, d in zip(log.trials, log.distress_trajectory):
            per_activity[t.activity_index].append(d)
        for i, ds in per_activity.items():
            out[i].append(ds[-1])
    return out


def main() -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    children = generate_population(N_EVAL, seed=EVAL_SEED)
    rows: list[dict] = []
    for child in children:
        rows.extend(trace_aura(child.clone_for_condition(EVAL_SEED * 1000 + child.child_index), EVAL_SEED * 1000 + child.child_index))
    lessons = [r for r in rows if not r["is_intervention"]]
    interventions = [r for r in rows if r["is_intervention"]]

    RESULTS.mkdir(exist_ok=True)
    (RESULTS / "figures").mkdir(exist_ok=True)
    fields = sorted({k for r in rows for k in r})
    with open(RESULTS / "trace_activities.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    # ---- IV-D: per-axis personalization accuracy, early vs late, and over time ----
    def acc(sel, axis):
        vals = [r[f"{axis}_correct"] for r in sel]
        return sum(vals) / len(vals) if vals else float("nan")

    chance = {"teaching_method": 1 / 2, "modality": 1 / 2, "theme": 1 / 4}
    early = [r for r in lessons if r["activity"] < 10]
    late = [r for r in lessons if r["activity"] >= N_ACTIVITIES - 10]

    # final choice per child = majority arm over its last 10 lesson activities
    final_correct = {axis: [] for axis in AXES}
    by_child: dict[int, list[dict]] = defaultdict(list)
    for r in lessons:
        by_child[r["child"]].append(r)
    for child in children:
        tail = by_child[child.child_index][-10:]
        truth = {"teaching_method": child.true_best_method, "modality": child.true_best_modality, "theme": child.true_best_theme}
        for axis in AXES:
            if tail:
                majority = Counter(r[axis] for r in tail).most_common(1)[0][0]
                final_correct[axis].append(majority == truth[axis])

    bins = list(range(0, N_ACTIVITIES, 5))
    fig, ax = plt.subplots(figsize=(7, 4))
    for axis, label in (("teaching_method", "Teaching method"), ("modality", "Interaction mode"), ("theme", "Interest theme")):
        ys = [acc([r for r in lessons if b <= r["activity"] < b + 5], axis) * 100 for b in bins]
        line = ax.plot([b + 2.5 for b in bins], ys, marker="o", label=label)[0]
        ax.axhline(chance[axis] * 100, color=line.get_color(), linestyle=":", linewidth=1)
    ax.set_xlabel("Activity number")
    ax.set_ylabel("% of choices matching the child's true best arm")
    ax.set_title("Personalization over time (AURA, N=80; dotted = chance)")
    ax.set_ylim(0, 100)
    ax.legend()
    fig.tight_layout()
    fig.savefig(RESULTS / "figures" / "trace_axis_accuracy.png", dpi=160)
    plt.close(fig)

    # ---- IV-C/D: explore -> exploit over time ----
    kinds = ("explore", "exploit", "safe_fallback", "locked")
    fig, ax = plt.subplots(figsize=(7, 4))
    shares = {k: [] for k in kinds}
    for b in bins:
        decs = [r[f"{axis}_decision"] for r in lessons if b <= r["activity"] < b + 5 for axis in AXES]
        n = max(1, len(decs))
        for k in kinds:
            shares[k].append(100 * sum(d == k for d in decs) / n)
    bottom = [0.0] * len(bins)
    for k in kinds:
        if any(shares[k]):
            ax.bar([b + 2.5 for b in bins], shares[k], width=4, bottom=bottom, label=k.replace("_", " "))
            bottom = [x + y for x, y in zip(bottom, shares[k])]
    ax.set_xlabel("Activity number")
    ax.set_ylabel("% of arm decisions")
    ax.set_title("Exploration gives way to exploitation")
    ax.legend()
    fig.tight_layout()
    fig.savefig(RESULTS / "figures" / "trace_explore_exploit.png", dpi=160)
    plt.close(fig)

    # ---- IV-E: interventions ----
    by_type: dict[str, list[dict]] = defaultdict(list)
    for r in interventions:
        by_type[r["intervention"]].append(r)
    fig, ax = plt.subplots(figsize=(7, 4))
    names = sorted(by_type)
    drops = [statistics.mean(r["distress_before"] - r["distress_after"] for r in by_type[n]) for n in names]
    ax.bar([n.replace("_", " ") for n in names], drops, color="#5CB8F2")
    ax.set_ylabel("Mean drop in (simulated) distress")
    ax.set_title("Different interventions, different relief")
    fig.tight_layout()
    fig.savefig(RESULTS / "figures" / "trace_interventions.png", dpi=160)
    plt.close(fig)

    # ---- IV-E: engagement (distress) over the session, AURA vs static ----
    aura_d: dict[int, list[float]] = defaultdict(list)
    for r in lessons:
        aura_d[r["activity"]].append(r["distress"])
    static_d = static_distress_by_activity(children)
    xs = list(range(N_ACTIVITIES))
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.plot(xs, [statistics.mean(aura_d[i]) if aura_d.get(i) else float("nan") for i in xs], label="AURA")
    ax.plot(xs, [statistics.mean(static_d[i]) if static_d.get(i) else float("nan") for i in xs], label="Static baseline")
    ax.axhline(DISTRESS_THRESHOLD, color="grey", linestyle=":", linewidth=1)
    ax.set_xlabel("Activity number")
    ax.set_ylabel("Mean simulated distress (0–1)")
    ax.set_title("Distress stays low under AURA")
    ax.legend()
    fig.tight_layout()
    fig.savefig(RESULTS / "figures" / "trace_distress.png", dpi=160)
    plt.close(fig)

    # ---- summary ----
    difficulties = Counter(r["difficulty"] for r in lessons)
    decision_totals = Counter(r[f"{axis}_decision"] for r in lessons for axis in AXES)
    relevant = [r for r in interventions if r["distress_before"] >= DISTRESS_THRESHOLD]
    lines = [
        "# Trace analysis (Section IV-C/D/E)",
        "",
        f"Mechanically generated by `research/run_trace_analysis.py` — N={N_EVAL} simulated children, {N_ACTIVITIES} activities each, "
        f"EVAL_SEED={EVAL_SEED} (the same population as the simulation study), real production DecisionEngine.",
        "",
        f"- Lesson activities logged: {len(lessons)}; intervention activities: {len(interventions)}",
        f"- Difficulty values emitted: {dict(difficulties)}",
        f"- Arm decisions by type: {dict(decision_totals)}",
        "",
        "## Personalization accuracy per axis (% of choices matching the child's true best arm)",
        "",
        "| Axis | Chance | First 10 activities | Last 10 activities | Final choice correct (majority of last 10) |",
        "|---|---|---|---|---|",
    ]
    for axis in AXES:
        fc = final_correct[axis]
        lines.append(f"| {axis} | {chance[axis]*100:.0f}% | {acc(early, axis)*100:.1f}% | {acc(late, axis)*100:.1f}% | {100*sum(fc)/len(fc):.1f}% ({sum(fc)}/{len(fc)}) |")
    lines += [
        "",
        "## Share of decisions made on a confirmed per-child winner (\"exploit\"), by activity block",
        "",
        "| Activities | " + " | ".join(AXES) + " |",
        "|---|" + "---|" * len(AXES),
    ]
    for b in bins:
        sel = [r for r in lessons if b <= r["activity"] < b + 5]
        cells = [f"{100 * sum(r[f'{axis}_decision'] == 'exploit' for r in sel) / max(1, len(sel)):.1f}%" for axis in AXES]
        lines.append(f"| {b + 1}–{b + 5} | " + " | ".join(cells) + " |")
    lines += [
        "",
        "## Interventions",
        "",
        "| Intervention | Times chosen | Mean distress before | Mean distress after | Recovered below 0.6 (of episodes starting ≥0.6) | Was the child's true best |",
        "|---|---|---|---|---|---|",
    ]
    for n in names:
        rs = by_type[n]
        rel = [r for r in rs if r["distress_before"] >= DISTRESS_THRESHOLD]
        rec = f"{sum(r['distress_after'] < DISTRESS_THRESHOLD for r in rel)}/{len(rel)}" if rel else "—"
        lines.append(
            f"| {n} | {len(rs)} | {statistics.mean(r['distress_before'] for r in rs):.2f} | {statistics.mean(r['distress_after'] for r in rs):.2f} | {rec} | "
            f"{sum(r['intervention_is_best'] for r in rs)}/{len(rs)} |"
        )
    if relevant:
        lines += ["", f"Overall recovery on genuinely distressed episodes: {sum(r['distress_after'] < DISTRESS_THRESHOLD for r in relevant)}/{len(relevant)}"]
    aura_mean = statistics.mean(r["distress"] for r in lessons)
    static_all = [d for ds in static_d.values() for d in ds]
    lines += ["", f"Mean simulated distress across all lesson activities: AURA {aura_mean:.3f} vs static {statistics.mean(static_all):.3f}", ""]
    (RESULTS / "trace_summary.md").write_text("\n".join(lines))
    print("\n".join(lines))


if __name__ == "__main__":
    main()
