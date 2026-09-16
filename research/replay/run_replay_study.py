"""
Batch-replays every digitized case in research/replay/cases/ and writes an
aggregate report — the "pilot readiness" half of the replay study
(docs/PLAN.md Phase 8/9): once a real published case is added here (see
README.md — that step needs a human with journal access and PlotDigitizer,
not more code), this is the one command that turns it into a result table,
no per-case scripting required.

Run from the repo root: backend/.venv/bin/python -m research.replay.run_replay_study

Every case is a pair of files sharing a basename:
  cases/<name>.csv   — the digitized points (session,condition,value,n)
  cases/<name>.json  — metadata: {"is_synthetic": bool, "citation": str,
                        "reference_winner": str (optional), "notes": str (optional)}
A case missing or with invalid metadata is SKIPPED WITH A WARNING, never
silently included and never allowed to crash the whole batch — one bad case
must not take down the report for every good one.
"""
import csv
import json
from pathlib import Path

import research  # noqa: F401 — sys.path bootstrap
from research.replay.harness import load_case, replay_case

CASES_DIR = Path(__file__).resolve().parent / "cases"
RESULTS_DIR = Path(__file__).resolve().parent / "results"


def load_metadata(csv_path: Path) -> dict | None:
    json_path = csv_path.with_suffix(".json")
    if not json_path.exists():
        print(f"SKIPPING {csv_path.name}: no matching {json_path.name} — every case needs a metadata sidecar, see research/replay/README.md.")
        return None
    try:
        meta = json.loads(json_path.read_text())
    except json.JSONDecodeError as exc:
        print(f"SKIPPING {csv_path.name}: {json_path.name} is not valid JSON ({exc}).")
        return None
    if not isinstance(meta.get("is_synthetic"), bool):
        print(f"SKIPPING {csv_path.name}: {json_path.name} needs a boolean 'is_synthetic' field.")
        return None
    if not meta.get("citation"):
        print(f"SKIPPING {csv_path.name}: {json_path.name} needs a non-empty 'citation' field (even a synthetic case should say what it is).")
        return None
    return meta


def run_all() -> list[dict]:
    rows = []
    for csv_path in sorted(CASES_DIR.glob("*.csv")):
        meta = load_metadata(csv_path)
        if meta is None:
            continue
        try:
            points = load_case(csv_path)
            verdict = replay_case(points, reference_winner=meta.get("reference_winner"))
        except Exception as exc:  # noqa: BLE001 — one malformed case must never crash the batch
            print(f"SKIPPING {csv_path.name}: failed to replay it ({exc}).")
            continue

        reference_winner = meta.get("reference_winner")
        rows.append(
            {
                "case": csv_path.stem,
                "is_synthetic": meta["is_synthetic"],
                "citation": meta["citation"],
                "total_sessions": verdict.total_sessions,
                "session_of_decision": verdict.session_of_decision,
                "winner": verdict.winner,
                "reference_winner": reference_winner,
                "agrees_with_reference": (verdict.winner == reference_winner) if reference_winner else None,
                "sessions_saved": verdict.sessions_saved,
            }
        )
    return rows


def write_csv(rows: list[dict], path: Path) -> None:
    if not rows:
        return
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def write_markdown(rows: list[dict], path: Path) -> None:
    lines = ["# Replay study results", ""]
    real_rows = [r for r in rows if not r["is_synthetic"]]

    if not real_rows:
        lines.append(
            "**No real published cases yet.** Every case below is synthetic/placeholder — "
            "see `research/replay/README.md` for how to digitize and add a real one."
        )
        lines.append("")
    else:
        agreements = [r["agrees_with_reference"] for r in real_rows if r["agrees_with_reference"] is not None]
        if agreements:
            rate = sum(agreements) / len(agreements)
            lines.append(
                f"**{sum(agreements)}/{len(agreements)} real cases** where AURA's replayed stopping rule "
                f"agreed with the published study's own conclusion ({rate * 100:.0f}%)."
            )
        saved = [r["sessions_saved"] for r in real_rows if r["sessions_saved"] is not None]
        if saved:
            lines.append(f"Average sessions saved vs. each study's own full length: {sum(saved) / len(saved):.1f}.")
        lines.append("")

    lines.append("| Case | Citation | Sessions | Decided at | Winner | Reference | Agrees | Sessions saved |")
    lines.append("|---|---|---|---|---|---|---|---|")
    for r in rows:
        tag = " *(SYNTHETIC)*" if r["is_synthetic"] else ""
        agrees = "—" if r["agrees_with_reference"] is None else ("✓" if r["agrees_with_reference"] else "✗")
        citation = r["citation"][:70] + ("…" if len(r["citation"]) > 70 else "")
        lines.append(
            f"| {r['case']}{tag} | {citation} | {r['total_sessions']} | {r['session_of_decision']} | "
            f"{r['winner']} | {r['reference_winner'] or '—'} | {agrees} | {r['sessions_saved'] if r['sessions_saved'] is not None else '—'} |"
        )

    path.write_text("\n".join(lines) + "\n")


def main():
    RESULTS_DIR.mkdir(exist_ok=True)
    rows = run_all()
    if not rows:
        print("No valid cases found in research/replay/cases/ — nothing to report.")
        return
    write_csv(rows, RESULTS_DIR / "replay_results.csv")
    write_markdown(rows, RESULTS_DIR / "replay_summary.md")
    print(f"{len(rows)} case(s) processed -> {RESULTS_DIR / 'replay_summary.md'}")


if __name__ == "__main__":
    main()
