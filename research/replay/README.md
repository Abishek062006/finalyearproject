# Replay study

docs/PLAN.md Phase 8, part 3 / README §4 "Filling the gap": digitize a
session-by-session graph from a published single-case study (autistic
children, teaching-method or interaction comparisons — e.g. the massed vs
distributed practice studies README §2 cites: Majdalany et al. 2014, Haq &
Kodak 2015), replay the points through AURA's own stopping rule one session
at a time, and ask: **would AURA have reached the same verdict as the
published study, and how much sooner?**

## What's real here vs what still needs you

- `harness.py` is real, tested code — a standalone reimplementation of
  `app/engine/effect_estimator.py`'s exact Beta-Binomial posterior and
  non-overlapping-CI stopping rule (same constants: population prior 2/2,
  `MIN_EVIDENCE_TRIALS=8`), operating on a plain CSV instead of the app's
  database.
- `run_replay_study.py` is real, tested code too — it batch-processes every
  case in `cases/` and writes an aggregate report to `results/`, so that
  once a real case exists, turning it (and every case after it) into a
  result is one command, not a one-off script per case.
- `cases/example_synthetic_case.csv` (+ its `.json` metadata) is **entirely
  made up by hand** for this repo — a plausible 8-session
  alternating-treatments shape, NOT digitized from any real publication. It
  exists only to prove the harness and batch runner actually work, and its
  metadata explicitly marks it `"is_synthetic": true` so it can never be
  silently mistaken for a real finding in a report.
- **No real published data is included.** I (the assistant that built this)
  cannot access or reproduce a real journal figure — that would also be a
  copyright problem to embed in this repo. Getting real cases in here is a
  manual step for whoever runs this study next — this file, and
  `run_replay_study.py`'s validation, exist to make that step as close to
  "drop two files in a folder and run one command" as possible.

## How to add a real case

Every case is **two files sharing a basename** in `cases/`:

```
cases/
├── majdalany_2014_child3.csv
├── majdalany_2014_child3.json
├── example_synthetic_case.csv     (already here, for the mechanism check)
└── example_synthetic_case.json
```

1. Find a published single-case (or alternating-treatments / ABAB) graph
   comparing two teaching conditions for an autistic child — e.g. from the
   papers README §2 already cites, or any similarly-designed study your
   university library gives you access to.
2. Use [PlotDigitizer](https://plotdigitizer.com) (free, browser-based,
   validated for exactly this in prior single-case-design research) to read
   each data point's (session number, value) off the published figure, for
   each condition/phase shown.
3. Save the points as `cases/<name>.csv` with these columns:

   ```csv
   session,condition,value,n
   1,A,0.6,5
   1,B,0.4,5
   ...
   ```

   - `session`: the x-axis session/day number from the graph.
   - `condition`: whatever label the graph uses for each phase/condition
     (e.g. "errorless"/"try_then_correct", or "A"/"B" if that's all the
     published figure gives you).
   - `value`: the y-axis value, converted to a 0–1 proportion (accuracy,
     % correct / 100, etc — whatever the graph's y-axis actually is).
   - `n`: how many trials that session's point represents, if the paper says
     so (e.g. "10 trials/session"); otherwise leave it as 1 and treat each
     plotted point as a single Bernoulli-style observation — coarser, but
     still usable.
4. Save `cases/<name>.json` with the SAME basename as the CSV:

   ```json
   {
     "is_synthetic": false,
     "citation": "Majdalany et al. (2014), Child 3, Figure 2",
     "reference_winner": "distributed",
     "notes": "Optional: anything about how you read the graph worth remembering later."
   }
   ```

   - `is_synthetic` (**required**, boolean): `false` for a real digitized
     case. A case whose `.json` is missing, invalid, or missing this field
     is **skipped with a printed warning**, never silently included — this
     is deliberate: a real finding must never be produced from a case the
     tooling couldn't actually validate.
   - `citation` (**required**): where this came from. Keep it precise
     enough to put directly into the paper's references.
   - `reference_winner` (optional): whatever verdict the PUBLISHED study
     itself reached (which condition "won") — needed to compute
     `agrees_with_reference`; omit it if the paper's own conclusion isn't a
     clean single-condition verdict.
   - `notes` (optional).

5. Run every case in `cases/` at once:

   ```bash
   backend/.venv/bin/python -m research.replay.run_replay_study
   ```

   Writes `results/replay_results.csv` (one row per case) and
   `results/replay_summary.md` (a human-readable table, plus an aggregate
   agreement rate once at least one real, non-synthetic case exists).

   For a single case without going through the `cases/` folder (e.g. while
   still digitizing and iterating on one before committing it), you can also
   call the harness directly:

   ```bash
   backend/.venv/bin/python -m research.replay.harness path/to/your_case.csv <reference_winner>
   ```

## Reading the result

- `session_of_decision`: the session index at which AURA's stopping rule
  would have already locked onto a winner, replaying the SAME points the
  published study collected.
- `sessions_saved`: how many sessions earlier than the study's own full
  length that would have been — the concrete version of README §2's "ends
  comparisons in days, not weeks" claim.
- `agrees_with_reference`: whether AURA's replayed verdict matches which
  condition the original published study concluded was better. Disagreement
  is itself informative — it would mean AURA's simpler statistical rule (no
  clinical judgement, no visual-inspection nuance) reads the SAME data
  differently than the study's authors did, worth a real discussion
  paragraph in the paper if it happens, not something to discard.
- The aggregate line in `replay_summary.md` ("N/M real cases where AURA's
  verdict agreed...") only ever counts cases with `"is_synthetic": false` —
  the synthetic example is always shown in the table (clearly tagged) but
  never folded into that headline number.
