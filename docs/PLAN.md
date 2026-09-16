# AURA — Phase-Based Build Plan

Read [../README.md](../README.md) first. That file defines what we are building and why.

**Golden rule for every phase:** the randomized per-child comparison is the research
contribution. Features may be cut; that may not.

---

## Progress log

- **Phase 0 — done.** Repo, SQLite (no Docker), FastAPI + Expo both boot.
- **Phase 1 — done.** Full 31-table schema built and verified (`docs/SCHEMA.md`);
  `scripts/seed.py` seeds numeracy num_1_5, 4 themes, 2 matched item sets, and the
  `teaching_method` + `modality` axes.
- **Phase 2 — done, and pulled forward Phase 4's core.** Per the Phase 1 guardrail
  ("log the randomization from day one"), the vertical slice already includes a real
  `ExperimentManager` + `EffectEstimator` (Thompson sampling, hierarchical prior,
  non-overlapping-CI winner detection) + safety layer, not just a rule-based planner.
  Verified end-to-end in-browser against the real backend. Two real bugs found and
  fixed along the way (unstable `useMemo` shuffle dependency; `measureInWindow` not
  existing on web). **Known gap:** `drag_drop` couldn't be verified via automated
  browser mouse simulation — needs a manual check on a real tablet/simulator before
  the pilot (see `docs/RUNNING.md`).
- **Phase 3 — done.** Real auth (JWT, bcrypt directly — passlib 1.7.4 is incompatible
  with bcrypt>=4.1, see `app/core/security.py`), parent API (create/list children,
  summary, recommendations, consent), and the parent UI (login/register, child list,
  create child with initial interests, dashboard, consent). `ActivityInstance.completed`
  was silently never being set — fixed, since the dashboard's activity count depends
  on it. Verified end-to-end in-browser: register → auto-login → create child → play
  a full round across both modalities → dashboard reflects real minutes/completions/
  suggestions → consent toggle persists (append-only) → token survives a page reload.
  Navigation is a small hand-rolled screen-state switch in `App.tsx`, not a routing
  library — fine at this size; reconsider (react-navigation) once the educator
  dashboard in Phase 4 adds more screens and back-stack behavior starts to matter.
- **Phase 4 — done.** Educator/counsellor dashboard, arm locks, topic assignment, and
  drift-triggered re-testing.
  - `require_educator_of` (a guardian is NOT automatically an educator of their own
    child — deliberately different detail levels, README §2B) + parent-side
    "grant access by email" flow (`POST /parent/children/{id}/educators`).
  - `EducatorChildProfile`: domain mastery + per-axis evidence (trials, accuracy,
    current winner), explicitly labelled "internal model estimates" per README §2B.
  - Educators can lock/unlock arms and assign a topic (honored by `SessionPlanner`
    for 24h, `reason="educator_assigned"`) — both verified end-to-end, including
    confirming via curl that a locked modality genuinely never appears again.
  - **Drift-triggered re-testing** added to `EffectEstimator`: a confirmed winner
    whose most recent 5 trials have regressed >0.3 below its lifetime average is no
    longer exploited, reopening exploration — a plain lifetime Bayesian average
    alone absorbs a real regression far too slowly once evidence has piled up.
  - **Real bug found and fixed while building this:** `TherapistLocks.allowed_arms`
    only ever checked for *any* `allow=False` row, so an educator un-blocking an arm
    (a later `allow=True` row) could never take effect. Locks are now "latest row
    wins", like consent. Regression test added.
  - Verified end-to-end in-browser across two logged-in roles: parent registers,
    creates a child, plays real rounds; a separate educator account registers,
    the parent grants it access, the educator sees live per-arm evidence generated
    from those rounds, blocks an arm, and a fresh curl check against the session API
    confirms the block is genuinely enforced by the live engine.
  - 6 new backend tests (drift detection, lock "latest wins", educator link/profile/
    access-control, lock enforcement via the session API, topic assignment honored
    by the session API, clean 404s for bad topic/axis codes) — 15/15 total passing.
- **Phase 5 — done.** RetentionModel, delayed-probe delivery, audit probes.
  - `RetentionModel`: half-life regression (R(t) = retention_estimate · 2^(−t/half_life),
    the same mechanism behind Anki/FSRS). A correct answer roughly doubles the
    half-life; an incorrect one halves it. Scaling by `retention_estimate` (not a
    bare `2^0`) matters: without it, a wrong answer's retention reads as "fully
    retained" at the instant of the mistake, since t=0.
  - `SessionPlanner.next_topic` priority order is now: educator assignment →
    earliest due revision probe → lowest mastery.
  - `DecisionEngine` prefers the **exact item set** a due probe was scheduled
    against (not a fresh random pick), so a delayed check tests recall of the
    actual taught material rather than confounding retention with difficulty.
  - Delayed outcomes close the loop from Phase 1's schema design: completing a
    fresh (non-probe) activity schedules a 3-day and 7-day `ScheduledProbe` per
    active-axis assignment; answering a due probe records `retention_3d`/
    `retention_7d` `Outcome` rows attributed back to the **original** teaching
    assignment, not the probe's own. Verified live end-to-end against the running
    server (not just tests): a real assignment from the original teaching activity
    received real `retention_3d` outcomes days "later" (time-travelled via `due_at`).
  - Audit probes (`delay_days=0`): scheduled at `end_session`, independent of
    confidence — a topic the model currently believes is mastered gets an
    occasional spot-check regardless, so the system can actually notice being wrong.
  - `parent_service.topics_to_review` now reads `RetentionModel.due_for_revision`
    instead of a raw mastery threshold; the API/schema field was honestly renamed
    `mastery_percent` → `retention_percent` end-to-end (backend schema, frontend
    types, frontend display) rather than kept as a misleading name.
  - **Serious pre-existing bug found and fixed, unrelated to retention itself:**
    `LearnerModel.update`'s alpha/beta reconstruction (`alpha = PRIOR_ALPHA +
    mean·n`) has an exact fixed point at mean=0.6 for the default prior — after
    the first update, EVERY subsequent correct answer left mastery stuck at
    0.6 forever, no matter how many more followed. Found because audit probes
    never fired in testing (mastery could never reach the 0.85 threshold). Fixed
    to the correct reconstruction (`alpha = mean · (PRIOR_ALPHA+PRIOR_BETA+n)`);
    verified against the closed-form Beta-Bernoulli posterior mean exactly.
    This bug affected every mastery estimate computed since Phase 2 — difficulty
    adaptation, "topics to review" (old version), and the educator dashboard's
    domain percentages were all silently capped near 0.6 for any child with more
    than one or two correct answers in a row.
  - Also fixed two test-authoring bugs while building this (SQLAlchemy identity-
    map aliasing across two "before/after" ORM object references comparing an
    object against its own later mutation; a wrong expected-count assumption for
    per-axis outcome fan-out) — both are documented inline in the test file.
  - 11 new tests (retention decay, wrong-answer-lowers-retention-immediately,
    half-life growth/shrink, due-for-revision filtering, probe scheduling +
    dedup, full probe delivery + outcome attribution, audit probe scheduling,
    parent summary reflects retention, plus 2 dedicated LearnerModel regression
    tests) — 26/26 total passing.
- **Phase 6 — done.** EngagementModel, conditional interventions, session-length
  recommendation.
  - `EngagementModel`: rules over a session's own answer history — error streak,
    response-time trend vs. that session's own baseline, abandonment — into
    high/stable/declining (README §14, never a diagnosis).
  - `DecisionEngine` finally receives a REAL distress signal: Phases 1-5 fed
    `DistressMonitor` a hardcoded `0.0`, so its safe-fallback branch had never
    actually been exercised outside tests.
  - The "intervention" axis (`mini_game`, `interest_injection`, `modality_switch`,
    `break`) is deliberately **not** in `ExperimentManager.ACTIVE_AXIS_CODES` — it
    is only assigned when engagement is declining and no intervention is already
    pending, reusing the SAME Thompson-sampling `choose_arm` as the lesson axes.
  - **Real fix needed to make that reuse actually work:** `EffectEstimator.winner`
    and `.posterior` were hardcoded to judge every axis on `kind="immediate"`
    (correctness) — meaningless for `break`, which has no right answer. Added an
    `outcome_kind` parameter threaded through `DecisionEngine.choose_arm` so the
    intervention axis is judged on `engagement_60s` (did engagement recover)
    instead, while teaching_method/modality still use `immediate`.
  - `InterventionModel` records the before/after and attributes the recovery
    outcome back to the intervention's OWN assignment (not the lesson's) —
    verified end-to-end **live against the running server**: 4 wrong answers in a
    row pushed distress into `safe_fallback`, correctly selecting `break` (its
    safe-default arm); `engagement_before=0.3` was recorded; after the child
    returned and answered one real item, `engagement_after_60s=0.7` and exactly
    one `engagement_60s` Outcome landed on the intervention's assignment.
  - Session-length recommendation (README §19): populated at `end_session` from
    how long engagement actually held up before first declining, averaged over
    recent sessions, clipped to 10-30 minutes — not a fixed duration, not a
    clinical attention-span claim.
  - Child app: `InterventionScreen.tsx` renders all four arms with genuinely
    distinct interactions (tap-the-stars, a themed greeting, a real drag gesture,
    a breathing pause with a delayed button) — the backend decides which one, the
    screen just renders it.
  - Educator dashboard: the intervention axis appears automatically in the
    existing per-axis evidence view, labelled "engagement recovery" instead of
    "% success" since correctness isn't the relevant measure there.
  - 10 new tests (engagement state classification x4, intervention triggering +
    no-stacking + outcome attribution x3, intervention outcomes feed the same
    EffectEstimator x1, session-length recommendation x3) — **36/36 total passing.**
- **Phase 7 — done.** Offline content bank + theme as a real, randomized axis.
  - **No runtime API cost, by design** (explicit project constraint): all themed
    text is generated ONCE by `content/generator/generate_theme_content.py`, a
    standalone offline script, never called from the running app. It best-effort
    tries a local Ollama model (3s timeout, `llama3.2`) and falls back to a
    deterministic template on any failure — Ollama wasn't installed on this
    machine, so all 4 themes used the template path. Output is validated (word
    count ≤8, banned-word list, no idioms/sarcasm — README's "literal language"
    requirement for this population) and written once to
    `content/bank/theme_content.json`, a static file the backend reads at
    request time via `app/services/content_bank.py` (`lru_cache`d, falls back to
    a generic string if a theme is missing or not `review_status: approved`).
  - `theme` is now a real 4th entry in `ExperimentManager.ACTIVE_AXIS_CODES`
    (`dino`/`space`/`ocean`/`cars`), assigned via the same Thompson-sampling
    `choose_arm` as `teaching_method`/`modality` — not inferred from which theme
    a child happens to click, an actual randomized comparison per README §6/§7.
    `scripts/seed.py` now builds one matched item set per theme (4, up from 2)
    in the same `match_group`, so the comparison is never confounded by
    difficulty.
  - `DecisionEngine.decide` resolves the chosen theme once per activity and
    threads it through: a fresh pick uses `matched_item_set(topic_id,
    theme_id=...)`; continuing a due retention probe reuses the probe's own
    original theme instead (Phase 5's rule takes priority). `prompt_text` and
    `encouragement` are pulled from `content_bank.get_theme_content` and put on
    `ActivitySpec` so the frontend never hardcodes them.
  - Parent-facing **Interests** summary (README §2A #10 — "dynamically
    discovered interests"): `parent_service.interest_summary` ranks the theme
    axis's per-arm posteriors and reports only a friendly tier
    (`high_interest`/`steady`/`still_building`/`still_discovering`) — never the
    raw percentage or posterior mean, which stays educator-only per README §2A/
    §2B. Below `MIN_EVIDENCE_TRIALS` (8) a theme is always `still_discovering`,
    regardless of its early mean, so a lucky first guess can't read as a
    confirmed preference.
  - Frontend wired end-to-end, not just the backend: `ActivitySpec` gained
    `prompt_text`/`encouragement`; `CountingScene` and `ChildScreen` render them
    instead of a hardcoded prompt/celebration string; the parent dashboard
    gained an "Interests" card (theme chips + tier label, no numbers).
  - 7 new backend tests (theme actually randomizes across many decisions rather
    than defaulting to one value, item-set items genuinely belong to the chosen
    theme, prompt text matches the content bank and differs by theme, a
    confirmed theme winner is exploited thereafter, every activity's theme
    assignment is auditable, interest summary is empty with no evidence yet,
    interest summary surfaces a confirmed winner as `high_interest` with no raw
    numbers in the payload) — **43/43 total passing.**
  - Verified live end-to-end against the running server (not just tests): 12
    real rounds (answered, not just fetched) showed all 4 themes being explored;
    `/parent/children/{id}/summary` returned a real ranked `interests` list from
    that evidence; the web child app rendered theme-specific text in the
    browser ("How many fish friends?" for `ocean`, guide "Splash") and the
    theme-specific encouragement line after a correct answer ("Great job!
    Splash is doing a happy dance!"); the parent dashboard's new Interests card
    rendered the same evidence as friendly chips.

---

## Parallel track — start in week 1, runs throughout

These have the longest lead time and block the pilot, not the code.

| Task | When | Why |
|---|---|---|
| Identify a partner special school / therapy centre | Week 1–3 | Everything in Phase 9 depends on it |
| Draft + submit ethics / IRB application | Week 2–6 | Approval takes 2–4 months |
| Parent consent + assent forms, privacy notice | Week 4–8 | Needed with the ethics application |
| Meet one special educator / BCBA as advisor | Week 2 onward | Validates the teaching options we compare |
| Maintain the reference library (Zotero) | Continuous | Paper writing |

---

## Phase 0 — Foundations (week 1)

**Goal:** the repo runs on your machine and every later decision has a home.

**Build**
- Repo + git, folder structure (below), `.env.example`, README, this plan
- FastAPI running locally with **SQLite** (no Docker, no deployment yet); Expo app boots
  in the browser and on a tablet over the local network
- `make dev`, `make test`, formatting (ruff, prettier)

**Deliverable:** "hello world" from child app → API → DB → back.
**Acceptance:** a button tap in the Expo app writes a row to the SQLite database.

> Postgres, Docker and deployment come later, only if the pilot needs them. SQLAlchemy +
> Alembic keep that a connection-string change.

---

## Phase 1 — Data model and experiment-grade logging (weeks 2–3)

**Goal:** the database can answer research questions later, not just render screens.

**Build**
- Tables: users, children, guardians, educators, consent, curriculum domains, topics,
  activities, item_sets, sessions, activity_instances, **interactions**, mastery_state,
  retention_state, interest_state, engagement_events, interventions, recommendations
- **Assignment tables** (the research core):
  `experiments`, `experiment_arms`, `assignments` — every activity records
  *which options were available*, *which was chosen*, *why (policy version + random seed)*,
  and whether it was an explore or exploit decision
- Seed script: curriculum library for 6 domains, 3 levels (from the AURA spec)
- Alembic migrations, Pydantic schemas, auth (JWT), role-based access

**Research guardrail:** log the counterfactual from day one. Data collected without
assignment records is useless for the paper.

**Deliverable:** ER diagram in `docs/SCHEMA.md` + seeded database.
**Acceptance:** a SQL query reconstructs, for any interaction, the full decision context.

---

## Phase 2 — Child vertical slice (weeks 4–6)

**Goal:** a child can complete a real themed lesson on a tablet and every signal is logged.

**Build**
- Tablet-landscape child UI: large targets, minimal text, calm palette, purposeful animation
- Interaction modes: **tap** and **drag-and-drop** (others come later)
- One domain end-to-end: Numeracy → numbers 1–5 (recognition, counting, matching)
- Interest themes: 4 themes, themed assets (emoji/SVG icon sets, no generated images)
- Companion guide character with instructions, encouragement, hints
- Embedded micro-probes (not quizzes): tap-the-number, drag-N-items, match, "what's missing"
- Signal capture: correctness, response time, attempts, hints used, abandonment,
  touch-off-target, hesitation before first touch, idle gaps

**Deliverable:** 10-minute playable session.
**Acceptance:** a 10-minute session produces a clean, analysable interaction log.

---

## Phase 3 — Deterministic adaptive core + Parent dashboard (weeks 7–9)

**Goal:** it adapts sensibly *before* any ML, and parents can see something real.

**Build**
- `LearnerModel`: Bayesian knowledge tracing per topic (mastery estimate + uncertainty)
- `DifficultyModel`: rules over accuracy + response time + attempts + hints
- `SessionPlanner`: builds the daily plan (topics, order, approximate duration)
- Parent dashboard: learning time, activities completed, progress by domain,
  topics to review, interests, today's suggestions (accept / skip), session history
- Consent + camera settings screen (camera still off)

**Research guardrail:** this rule-based version is **Baseline B** in the paper. Freeze it
and keep it runnable forever — it's your comparison condition.

**Deliverable:** working adaptive app without ML; parent dashboard v1.
**Acceptance:** a child struggling with numbers gets more numbers, presented differently.

---

## Phase 4 — ⭐ The research engine v1 (weeks 10–13)

**Goal:** the contribution exists in code.

**Build**
- `ExperimentManager`: builds **matched item sets** (equal difficulty, equal length),
  assigns arms randomly, alternates order, prevents confounds
- Axis 1: **teaching method** — errorless (answer shown, help fades) vs try-then-correct
- Axis 2: **interaction mode** — drag-drop vs tap
- `EffectEstimator`: Beta-Binomial posterior per child per arm, with a
  **hierarchical prior shared across children** (cold start)
- `DecisionEngine`: Thompson sampling + safety layer
  - **distress budget** — exploration pauses when distress signals rise
  - **therapist locks** — an adult can disable any arm
  - minimum-evidence rule before declaring a winner
- Teacher/Counsellor dashboard v1: per-child comparison charts in the
  single-case style therapists already read, plus "current winner + confidence"
- Override controls: assign topics, force an arm, reject a recommendation

**Deliverable:** AURA picks a per-child winner on two axes, with evidence shown.
**Acceptance:** in a scripted simulated child, the engine reaches the correct verdict
and the dashboard shows the chart justifying it.

---

## Phase 5 — Retention and revision (weeks 14–15)

**Build**
- `RetentionModel`: half-life regression style forecast per topic, trained/validated on
  **FSRS-Anki-20k** code path first, then on our own logs
- Revision scheduler feeding the session planner; parent-facing "Topics to Review"
- **Audit probes**: occasional random re-tests on "mastered" topics, independent of
  model confidence (otherwise the system never observes forgetting)
- 3-day and 7-day retention probes wired in as the **delayed outcome** for Phase 4 arms

**Acceptance:** a topic learned on day 1 resurfaces at the right time, and the delayed
outcome reaches the effect estimator.

---

## Phase 6 — Engagement and attention recovery (weeks 16–18)

**Build**
- `EngagementModel` v1: rules over latency, inactivity, abandonment, error bursts,
  tapping-rate change → engagement High / Stable / Declining (an **estimate**, not a diagnosis)
- `InterventionModel`: 4 interventions (mini-game, interest injection, modality switch,
  short break), each **5–20 seconds**
- Interventions become **Axis 3** of the experiment: which one restores engagement for
  *this* child, measured over the following 60 seconds
- Distress signals feed the Phase 4 safety layer
- Personalized session-length recommendation from observed engagement decay

**Acceptance:** engagement decline triggers a short intervention, and recovery is measured
and attributed to the intervention used.

---

## Phase 7 — GenAI content bank + interest axis (weeks 19–20)

**Build**
- Offline generator script: local LLM (Ollama) produces themed variants
  (word problems, story frames, prompts, encouragement) → **JSON content bank in the repo**
- Automatic checks: reading level, sentence length, banned content, literal language
  (no idioms/sarcasm), plus a human review pass before anything reaches a child
- Matched **cross-theme** item sets → interest becomes **Axis 4**, measured causally
  instead of from click counts
- Adaptive child UI: theme, guide character, reward style, animation frequency,
  amount of text, visual complexity follow the learned profile

**Research guardrail:** zero runtime API calls. Everything is pre-generated and cached.

**Acceptance:** the same lesson renders in two themes with genuinely matched difficulty.

---

## Phase 8 — Research evaluation (weeks 21–25) — **this is the paper**

**Build / run**
1. **Child simulator** — simulated learners whose best method differs, some distressed by
   errors, some with fast forgetting; parameters grounded in the published findings
2. **Baselines implemented:** static, heuristic-adaptive (Phase 3), correlational
   personalization, population-level policy, expert-manual comparison
3. **Simulation study** — metrics: sessions-to-decision, cumulative regret, trials to
   mastery, 7-day retention, engagement recovery rate, distress events
4. **Replay study** — digitize session-by-session graphs from published single-case
   studies with PlotDigitizer; ask whether AURA reaches the same verdict, and how much
   earlier; report agreement
5. **Ablations** — remove hierarchical prior / early predictor / safety layer / randomization
6. Notebooks + paper figures in `research/`

**Acceptance:** a results table showing AURA vs 5 baselines, plus the ablation table.
**At this point the paper is writable even if the pilot never happens.**

---

## Phase 9 — Pilot and paper (weeks 26–34)

**Build / run**
- Pilot readiness: consent flow, data export, offline mode, crash reporting,
  educator training sheet, daily backup
- Pilot: 5–10 children, 4–6 weeks, partner school. Compare AURA vs the frozen Phase 3
  baseline; record agreement with a therapist's manual verdict; log distress events
- Usability: SUS with teachers and parents
- Write the paper (target: IEEE Transactions on Learning Technologies, IEEE Access, or IEEE ICALT)
- Release: anonymized trial-level dataset + logging schema as an artifact

---

## Optional / later (only if time allows)

- Camera-based affect signals (off by default, heavy ethics cost, weakest evidence)
- Voice interaction and speech probes
- Deep models: DKT, neural forgetting model, sequence-based engagement network
- On-device inference (Core ML)
- Additional domains and modalities

---

## If you run out of time — cut in this order

1. Camera / affect (cut first, always)
2. Voice interaction
3. Domains 3–6 (keep Numeracy + Literacy)
4. Deep models (keep the interpretable Bayesian versions)
5. The pilot (Phase 8 alone still supports a paper)

**Never cut:** matched item sets, randomized assignment, assignment logging,
delayed retention outcomes, the safety layer. Cutting these deletes the contribution.

---

## Folder structure

```
final-year-project/
├── README.md                  # project brief: idea, novelty, datasets, guardrails
├── docs/
│   ├── PLAN.md                # this file
│   ├── ARCHITECTURE.md        # modules + data flow (Phase 0)
│   ├── SCHEMA.md              # ER diagram + table dictionary (Phase 1)
│   ├── EXPERIMENT-DESIGN.md   # arms, matching rules, stopping rules, safety
│   └── ETHICS/                # consent forms, privacy notice, application draft
├── backend/
│   ├── app/
│   │   ├── api/               # FastAPI routes
│   │   ├── models/            # SQLAlchemy models
│   │   ├── schemas/           # Pydantic
│   │   ├── services/          # curriculum, session, analytics
│   │   └── engine/            # ⭐ the research core
│   │       ├── learner_model.py
│   │       ├── difficulty_model.py
│   │       ├── retention_model.py
│   │       ├── engagement_model.py
│   │       ├── interest_model.py
│   │       ├── intervention_model.py
│   │       ├── experiment_manager.py     # matched sets, randomization
│   │       ├── effect_estimator.py       # per-child posteriors
│   │       ├── safety.py                 # distress budget, locks
│   │       └── decision_engine.py        # exploit + controlled explore
│   ├── alembic/
│   └── tests/
├── app/                       # Expo (React Native + web)
│   ├── src/child/             # tablet learning environment
│   ├── src/parent/            # parent dashboard
│   ├── src/educator/          # teacher / counsellor dashboard
│   ├── src/shared/            # components, theming, api client
│   └── assets/themes/         # per-theme icon sets
├── content/
│   ├── curriculum/            # topics, activities, item banks (JSON)
│   ├── generator/             # offline GenAI scripts (Ollama)
│   └── bank/                  # generated + reviewed content
├── research/
│   ├── simulator/             # simulated children
│   ├── baselines/             # static, heuristic, correlational, population, expert
│   ├── replay/                # digitized single-case data + replay harness
│   └── notebooks/             # analysis, paper figures
└── scripts/                   # seed, export, backup
```

---

## Weekly rhythm

- **Monday:** pick the phase's next acceptance test; write it first
- **Friday:** demo to yourself in the browser; screenshot into `docs/progress/`
- **Every 2 weeks:** update your guide with one slide: what works, what's next, what's blocked
- **Always:** if a change makes the app easier but weakens the randomization, don't do it
