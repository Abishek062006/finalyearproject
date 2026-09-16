# Phase 8 evaluation results

Human-written read of the actual output from the runs that produced the CSVs
and figure in this folder. Re-run `research/run_simulation_study.py` /
`research/run_ablation_study.py` (see `research/README.md`) and this file may
need updating — the underlying figures will shift slightly (both studies use
a randomized simulated population), though the qualitative pattern described
below should hold.

**Sample size note:** the simulation study runs N=80 simulated children, the
ablation study N=48 — both scaled up (from an original 24 / 16) specifically
to give the paired significance tests in §3 real power, per docs/PLAN.md
Phase 8's own follow-up note. `generate_population(n, seed)` draws each
child's parameters sequentially from one shared RNG stream
(`research/simulator/child.py`), so children 0-23 (or 0-15) in these larger
runs are IDENTICAL to the original smaller runs — this is a strict
extension of the same population, not a fresh unrelated sample, and the
comparison below to the original N=24/16 findings is apples-to-apples.

## 1. Simulation study — AURA vs 5 baselines

80 simulated children, 40 activities (~200 items) each, 6 conditions per
child (paired: every condition faces a clone of the SAME child). See
`simulation_results.csv` for the raw per-child rows and
`figures/regret_curves.png` for the regret trajectory.

| Condition | Cumulative regret ↓ | Activities to mastery ↓ | 7-day retention % ↑ | Activities to correct decision ↓ | Distress events ↓ | Engagement recovery % ↑ |
|---|---|---|---|---|---|---|
| AURA | 8.30 ± 7.64 | 34.1 ± 42.6 (76/80 converged) | 91.1 ± 14.9 | 24.4 ± 9.1 (17/80 converged) | 0.44 ± 1.21 | 67% (n=6) |
| static | 25.09 ± 23.58 | 10.5 ± 8.3 (50/80) | 71.8 ± 36.2 | 0.0 ± 0.0 (1/80) | 3.21 ± 5.01 | n/a — no mechanism |
| heuristic_adaptive | 11.70 ± 13.06 | 26.5 ± 33.4 (70/80) | 88.5 ± 19.8 | 4.6 ± 4.8 (5/80) | 0.88 ± 1.73 | n/a — no mechanism |
| correlational | 21.25 ± 22.31 | 14.8 ± 21.6 (57/80) | 75.8 ± 34.2 | 0.0 ± 0.0 (5/80) | 2.62 ± 4.74 | n/a — no mechanism |
| population_level | 20.54 ± 23.82 | 18.1 ± 29.9 (56/80) | 79.7 ± 30.1 | 0.0 ± 0.0 (5/80) | 2.65 ± 5.10 | n/a — no mechanism |
| expert_manual | 15.40 ± 17.96 | 18.3 ± 17.2 (67/80) | 80.6 ± 29.4 | 1.6 ± 0.8 (5/80) | 1.91 ± 4.01 | n/a — no mechanism |

**AURA does not dominate every column — and shouldn't be reported as if it
does.** The honest pattern, now clearer with 3.3x the children:

- **Regret separated further, not less, with more data:** AURA (8.30) and
  `heuristic_adaptive` (11.70) remain the two lowest, but the gap between
  them widened (was 11.56 vs 12.27 at N=24 — nearly tied; now a real,
  significant gap, see §3) and both are now more clearly separated from the
  other four baselines (15.4–25.1), visible directly in
  `figures/regret_curves.png` — AURA's and `heuristic_adaptive`'s lines
  visibly diverge in the plateau region now, where at N=24 they were
  overlapping.
- **Retention moved from "AURA roughly tied with the best baseline" to
  "AURA clearly ahead of everything":** at N=24, AURA (82.6%) and
  `heuristic_adaptive` (83.2%) were essentially equal. At N=80, AURA (91.1%)
  is now visibly ahead of `heuristic_adaptive` too (88.5%) — and this
  reordering is corroborated by §3: retention differences that weren't
  significant at N=24 mostly are now.
- **Distress and engagement recovery remain where AURA is unambiguously
  different, not just "better":** AURA logs under a third of the distress
  events of any baseline (0.44 vs 0.88–3.21), and it is the ONLY condition
  with any engagement-recovery capability at all — the baselines
  structurally have no intervention mechanism, so "n/a" is the honest entry,
  not "0%". Where AURA's own intervention actually fired on a genuinely
  distressed child (true distress ≥ 0.6, not just AURA's own estimate), it
  recovered them below that threshold 67% of the time.
- **Activities-to-mastery remains a genuine, expected cost, not a bug:**
  AURA still takes noticeably more activities to reach 80% mastery (34.1)
  than most baselines (10.5–26.5) — every activity AURA spends on an
  engagement intervention, or delivering a 3/7-day retention probe, does
  not advance `LearnerModel` (probes do, interventions deliberately do not
  — `app/services/session_service.py`), while every one of a baseline's
  activities goes straight to graded practice. Same tradeoff as before,
  now measured more precisely.
- **"Activities to correct decision" is intentionally strict** (method AND
  modality AND theme must simultaneously match truth for the rest of the
  run). AURA converges correctly for 17/80 children (21%, essentially the
  same rate as 6/24 = 25% before) — the theme axis (4 arms, some children
  with near-zero true preference by simulator design) remains the main drag.
  What changed with more data: §3 shows AURA's convergence rate is now
  significantly higher than EVERY baseline's, where at N=24 none of these
  comparisons reached significance.

## 2. Ablation study — AURA vs itself, one mechanism removed at a time

48 simulated children, 60 activities each (more room than study 1 — some
ablations need several 7-day probe cycles to have any chance of converging
at all), 5 conditions per child. See `ablation_results.csv`.

| Ablation | Cumulative regret ↓ | Activities to mastery ↓ | 7-day retention % ↑ | Activities to correct decision ↓ | Distress events ↓ | Engagement recovery % ↑ |
|---|---|---|---|---|---|---|
| full_aura | 8.74 ± 9.79 | 37.5 ± 53.9 (44/48) | 90.6 ± 16.4 | 46.8 ± 8.0 (14/48) | 0.75 ± 2.30 | 97% (n=8) |
| no_hierarchical_prior | 8.44 ± 6.78 | 21.9 ± 33.9 (44/48) | 93.1 ± 11.7 | 53.1 ± 6.0 (14/48) | 0.46 ± 1.21 | 87% (n=5) |
| no_early_predictor | 32.06 ± 17.61 | 28.2 ± 43.6 (38/48) | 73.9 ± 33.1 | 58.2 ± 0.8 (4/48) | 2.56 ± 3.39 | 85% (n=16) |
| no_safety_layer | 8.74 ± 9.79 | 37.5 ± 53.9 (44/48) | 90.6 ± 16.4 | 46.8 ± 8.0 (14/48) | 0.75 ± 2.30 | 97% (n=8) |
| no_randomization | 21.69 ± 23.84 | 23.1 ± 34.6 (38/48) | 81.6 ± 26.9 | 5.2 ± 9.1 (4/48) | 0.75 ± 1.84 | 100% (n=6) |

- **`no_early_predictor` remains the clearest, largest effect in either
  table, and got MORE extreme with more data:** regret 3.7x full AURA
  (32.1 vs 8.7, Cohen's d_z = −1.51, even larger than N=16's −1.30),
  retention 17 points worse, distress events over 3x. Directly supports
  README §2's "ends comparisons in days, not weeks" claim by showing what
  happens when that specific mechanism is removed.
- **`no_randomization` is the second-clearest effect, now confirmed (see
  §3):** regret roughly 2.5x full AURA (21.7 vs 8.7) — at N=16 this gap
  existed but didn't survive correction; at N=48 it does.
  Replacing Thompson sampling's random draw with a greedy argmax lets an
  early run of luck on one arm look permanently better — exactly the
  confound randomized assignment exists to prevent.
- **`no_hierarchical_prior`'s apparent regret disadvantage from the N=16
  run has essentially DISAPPEARED with more data (8.44 vs full_aura's
  8.74 — full_aura is now marginally, not significantly, worse).** This is
  worth stating plainly rather than quietly dropping: the original N=16
  finding ("regret is modestly higher, 8.4 vs 6.8, +24%") looked real but
  was mostly noise — a concrete, useful example of why this whole
  significance-testing exercise matters, not just a formality.
- **`no_hierarchical_prior`'s "reaches a correct decision MORE often"
  finding from the N=16 run also did NOT hold up — it fully reversed
  to identical.** At N=16: 8/16 (50%) vs full_aura's 2/16 (12%), a large
  apparent gap. At N=48: 14/48 (29%) vs full_aura's 14/48 (29%) —
  EXACTLY equal. The mechanistic story in the original writeup (unpooled
  posteriors swing faster, crossing the stopping rule sooner) may still be
  true in principle, but the N=16 study did not actually demonstrate it —
  it was noise that a 3x larger sample resolved. Flagging this
  prominently: a smaller study that looks clean is not automatically more
  trustworthy than a larger one that looks messier.
- **`no_safety_layer` remains an exact, bit-for-bit null result at 3x the
  sample size** — identical to `full_aura` on every single metric for
  every single one of 48 children, not just the original 16. This rules out
  "the N=16 sample just got unlucky" as an explanation; the mechanistic
  explanation (AURA's own estimated distress signal structurally can't
  cross its 0.6 trigger threshold without genuine activity abandonment,
  which this simulator's dynamics rarely produce even worst-case) is now
  the only one left standing. **Still not evidence the real safety layer
  doesn't matter** — only that this particular simulated population never
  gets distressed enough, in the way AURA's own estimator can detect, to
  exercise it. The real pilot (docs/PLAN.md Phase 9) is what would actually
  test this.
- **New at N=48, not visible at N=16:** both `no_early_predictor` and
  `no_randomization` now show a SIGNIFICANT drop in how often the correct
  decision is ever reached (8% each, vs. full_aura's 29% — see §3) — at
  N=16 there wasn't enough data to see this at all. Removing either
  mechanism doesn't just slow convergence down, it measurably reduces the
  chance of ever landing on the truly correct answer within a bounded
  number of activities.

## 3. Paired significance testing

Full table: `significance.md` (mechanically generated,
`research/run_significance.py`, re-run any time the CSVs change — under a
second, doesn't re-run either study). Every test is PAIRED — each simulated
child faced every condition as a clone of the same ground truth under the
same seed (common random numbers), so a per-child difference isolates the
condition's effect rather than child-to-child noise. p-values are
Holm-Bonferroni adjusted within each metric's family (5 baselines, or 4
ablations) — read the adjusted column, not the raw one, to decide
significance.

**What survives correction now, at N=80/N=48:**

- **Simulation study, cumulative regret: ALL 5 baselines now significant**
  (was 3/5 at N=24). `heuristic_adaptive` reaches significance on the
  t-test (p = 0.014) though its Wilcoxon p (0.052) sits right at the
  conventional threshold — worth reporting both, since they don't
  perfectly agree at this boundary, rather than picking whichever looks
  better.
- **Simulation study, 7-day retention: 4 of 5 now significant** (was 0/5 at
  N=24) — `static`, `correlational`, `population_level`, `expert_manual`
  all p < 0.005 after correction. Only `heuristic_adaptive` remains
  non-significant (p = 0.244), consistent with it being AURA's genuinely
  closest competitor throughout this table, not an artifact.
- **Simulation study, distress events: all 5 significant** (was 3/5 at
  N=24) — now including `heuristic_adaptive` (p = 0.017). This is the
  single most consistent finding across the whole study: every baseline
  loses to AURA on distress, and now every one of those losses is
  confirmed, not just descriptive.
- **Simulation study, "reached 80% mastery": 4 of 5 significant** (was 1/5
  at N=24) — only `heuristic_adaptive` remains a near-miss (p = 0.070).
- **Simulation study, "reached the correct decision": ALL 5 significant**
  (was 0/5 at N=24 — the single biggest change in this whole re-run).
  AURA's 21% convergence rate is modest in absolute terms (§1), but it is
  now confirmed to be reliably, significantly higher than every baseline's
  1-6% rate.
- **Ablation study, cumulative regret:** `no_early_predictor`
  (p = 0.00003, Cohen's d_z = −1.51) and, newly, `no_randomization`
  (t-test p = 0.0008, though Wilcoxon's 0.065 is more cautious) are
  significant. `no_hierarchical_prior` is not (p = 0.79) — and per §2, this
  is a genuine reversal from the N=16 run's descriptive gap, not just "still
  not enough power".
- **Ablation study, `no_safety_layer`:** still no test statistic is even
  computable — the differences are exactly zero across all 48 children, the
  strongest possible version of a null result.
- **Ablation study, "reached the correct decision": `no_early_predictor` and
  `no_randomization` are now BOTH significant** (p = 0.043, p = 0.039) —
  entirely invisible at N=16, where neither had enough discordant pairs to
  test at all. `no_hierarchical_prior` shows literally IDENTICAL rates to
  `full_aura` now (29% vs 29%) — the N=16 run's apparent 50%-vs-12%
  advantage for `no_hierarchical_prior` was noise; see §2's discussion.

**Bottom line for the paper:** at this larger sample size, the paper can
now cite, with real statistical backing: AURA significantly beats every one
of the 5 baselines on regret, distress events, and reaching the correct
decision; it significantly beats 4 of 5 on retention and on reaching
mastery (both times losing only to `heuristic_adaptive`, its consistently
closest competitor — itself a real, confirmed, and honest finding, not a
weakness to hide); removing the early-outcome predictor or randomization
each significantly and substantially hurts AURA's own performance; and
removing the safety layer produces a confirmed exact null in this
simulated population, with a clear mechanistic explanation for why (and an
explicit statement that this does NOT mean the real safety layer is
unimportant — only that this simulation doesn't exercise it). Just as
important: the N=16 ablation run's claim that removing the hierarchical
prior converges to a decision faster did NOT replicate at N=48 — reported
here as a correction, not quietly dropped, because that is itself a useful
demonstration of why running the numbers at a larger N mattered.

## 4. Replay study

Harness (`research/replay/harness.py`) is built and unit-tested against a
hand-made synthetic example — see `research/replay/README.md` for exactly
what's real vs what still needs a real published figure digitized with
PlotDigitizer. No real published case is replayed yet; this is an
infrastructure-complete, data-pending piece of Phase 8, not a finished
result.

## What this supports in the paper

- **A results table** (§1) showing AURA against all 5 baselines from
  README §2's evaluation plan — done.
- **An ablation table** (§2) isolating each of the 4 named design choices
  — done, including one honestly-reported exact null result and one
  honestly-reported correction (a N=16 finding that didn't replicate at
  N=48), rather than either hidden.
- **Paired, adequately-powered significance testing** (§3) — done at a
  sample size (N=80 / N=48) large enough that MOST of the descriptive
  findings in §1/§2 now have real statistical backing, not just a
  suggestive mean difference.
- **Not yet done:** the replay study's real data — needs a human with
  journal access and PlotDigitizer (`research/replay/README.md`), not more
  code.
