# research/ — Phase 8 evaluation

docs/PLAN.md Phase 8: the evaluation that makes the paper writable. Three
pieces, in the order README §4 "Filling the gap" describes them:

1. **Simulation study** (`run_simulation_study.py`) — AURA vs the 5 baselines
   from README §2, over a simulated population of children with different,
   independently-drawn "true best" teaching arms.
2. **Ablation study** (`run_ablation_study.py`) — full AURA vs itself with
   one design choice removed at a time (hierarchical prior / early predictor
   / safety layer / randomization).
3. **Paired significance testing** (`run_significance.py`) — paired t-test /
   Wilcoxon / exact McNemar on top of (1) and (2)'s already-collected
   results, Holm-Bonferroni adjusted across each metric's family of
   comparisons. Reads the existing CSVs; doesn't re-run either study.
4. **Replay study** (`replay/`) — digitize a real published single-case
   graph and ask whether AURA's stopping rule reaches the same verdict,
   sooner. The harness is real and tested; the real published data is not
   included (see `replay/README.md` for why, and how to add it).

Everything in (1), (2), and (3) is real, executed code producing real
numbers in `results/` — not a plan for numbers that could exist. Re-run
either study any time with the commands below; results will vary slightly
run to run (the population and Thompson sampling are both randomized,
seeded but not fixed across code changes) but the qualitative pattern
should hold — re-run `run_significance.py` afterward too, since it reads
whatever's currently in the CSVs.

## Why this drives the real backend, not a re-implementation

Every module here imports `app.engine.*` / `app.services.*` directly against
a throwaway in-memory SQLite database (see `db.py`, `__init__.py`). The
"AURA" condition in every study IS `DecisionEngine.decide()` — the literal
code the shipped app calls — not a stand-in. Two small, backward-compatible
production changes made this possible without duplicating its logic:

- `backend/scripts/seed.py`: the curriculum-building logic was factored out
  into `seed_curriculum(db)`, now shared by the real dev seed script, the
  pytest fixtures (`backend/tests/conftest.py`), and `research/db.py` — one
  source of truth for what "the seeded curriculum" means.
- `backend/app/services/session_service.py`: `next_activity()` gained an
  optional `engine` parameter (default: unchanged, a fresh unseeded
  `DecisionEngine`) so research code can inject a seeded engine
  (reproducible Thompson sampling) or an ablated subclass
  (`research/ablations.py`) without copying its ~60 lines of persistence
  logic.

## Running it

```bash
cd /path/to/final-year-project
backend/.venv/bin/pip install -r research/requirements.txt   # matplotlib + scipy, once
backend/.venv/bin/python -m research.run_simulation_study     # ~1-2 minutes
backend/.venv/bin/python -m research.run_ablation_study        # ~4-5 minutes
backend/.venv/bin/python -m research.run_significance            # <1 second
backend/.venv/bin/python -m pytest research/tests/ -v              # sanity tests, <1s
```

Output lands in `results/`: `simulation_results.csv` / `simulation_summary.md`
/ `figures/regret_curves.png`, `ablation_results.csv` / `ablation_summary.md`,
and `significance.md` (the paired tests). `results/RESULTS.md` is the
human-written narrative read of the numbers actually produced by the runs in
this repo — re-read it after re-running the studies, since a fresh run's
exact figures will differ slightly.

## What the simulated population represents, honestly

`simulator/child.py`'s docstring is the full explanation, but briefly: no
public dataset maps individual autistic children's teaching-method outcomes
(README §4 says so explicitly — "does not exist"). This simulator's
population is built to reproduce the qualitative STRUCTURE the cited
literature reports (opposite winners across children, idiosyncratic effect
sizes, some children with almost no real preference) — not fitted to any
specific published effect size, since no such per-child effect-size dataset
exists to fit against. It is a controlled testbed for comparing DECISION
POLICIES against a known ground truth, which is exactly what a simulation
study is for — it is not a claim about real children's actual response
magnitudes. That confrontation with real numbers is the replay study's job.

## Folder map

```
research/
├── db.py                    # throwaway in-memory seeded DB per run
├── simulator/child.py       # SimulatedChild ground-truth answering/distress model
├── baselines/                # the 5 comparison systems (README §2)
├── ablations.py              # 4 DecisionEngine subclasses, one design choice removed each
├── metrics.py                 # regret, sessions-to-decision, mastery, retention, distress, recovery
├── harness.py                  # drives one child through one condition, returns a RunLog
├── significance.py              # paired t-test / Wilcoxon / exact McNemar + Holm-Bonferroni
├── run_simulation_study.py       # AURA vs 5 baselines -> results/simulation_*
├── run_ablation_study.py          # AURA vs 4 ablations -> results/ablation_*
├── run_significance.py             # paired tests on top of the two CSVs above -> results/significance.md
├── replay/                          # single-case replay harness (see replay/README.md)
├── tests/                            # sanity tests, not a re-run of the full studies
└── results/                           # real output of the last run, + RESULTS.md narrative
```
