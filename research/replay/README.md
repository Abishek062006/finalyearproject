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
- `example_synthetic_case.csv` is **entirely made up by hand** for this
  repo — a plausible 8-session alternating-treatments shape, NOT digitized
  from any real publication. It exists only to prove the harness's mechanism
  actually works (`backend/.venv/bin/python -m research.replay.harness
  research/replay/example_synthetic_case.csv A`), and must never be cited as
  a real result.
- **No real published data is included.** I (the assistant that built this)
  cannot access or reproduce a real journal figure — that would also be a
  copyright problem to embed in this repo. Getting real cases in here is a
  manual step for whoever runs this study next.

## How to add a real case

1. Find a published single-case (or alternating-treatments / ABAB) graph
   comparing two teaching conditions for an autistic child — e.g. from the
   papers README §2 already cites, or any similarly-designed study your
   university library gives you access to.
2. Use [PlotDigitizer](https://plotdigitizer.com) (free, browser-based,
   validated for exactly this in prior single-case-design research) to read
   each data point's (session number, value) off the published figure, for
   each condition/phase shown.
3. Save it as a CSV with these columns:

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
4. Note whatever verdict the PUBLISHED study itself reached (which condition
   "won", and after how many sessions/phases) — you'll need this as the
   `reference_winner` to check agreement; it should already be written into
   the paper you're digitizing.
5. Run it:

   ```bash
   backend/.venv/bin/python -m research.replay.harness path/to/your_case.csv <reference_winner>
   ```

   or call `research.replay.harness.replay_file(path, reference_winner=...)`
   from a script if you're running several cases and want to aggregate them
   into a table (mirroring `research/run_simulation_study.py`'s pattern).

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
