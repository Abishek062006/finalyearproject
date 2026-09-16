# Running AURA locally

Two processes: the FastAPI backend (SQLite, no Docker) and the Expo app.

## Backend

```bash
cd backend
python3.11 -m venv .venv        # first time only
.venv/bin/pip install -r requirements.txt   # first time only
.venv/bin/python -m scripts.seed            # (re)seeds curriculum + resets the DB
.venv/bin/uvicorn app.main:app --reload --port 8000
```

- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health
- Re-run `scripts.seed` any time to reset to a clean state — it drops and
  recreates all tables (dev-only convenience, see the script's docstring).

Run the test suite (54 tests covering the vertical slice + the research
guardrails from docs/SCHEMA.md §9):

```bash
cd backend && .venv/bin/python -m pytest tests/ -v
```

## App (Expo)

```bash
cd app
npm install       # first time only
npm run web       # browser, fastest for iteration
# or: npm start    then press i (iOS) / a (Android)
```

**Phase 3 flow:** register/log in → add a child (pick a nickname, age band,
and a few interests) → **Play** to hand the tablet to the child, or
**View progress** for the parent dashboard (learning time, progress by
domain, today's suggestion, topics to review, session history) and
**Privacy & camera settings** (append-only consent — see docs/SCHEMA.md §2).

**Phase 5 (retention):** happens automatically, no new screen. Finishing a
topic's matched item set schedules a 3-day and 7-day check-back per active
axis; once due, it takes priority over new material (`topic_reason:
"due_revision"` in the debug strip) and reuses the exact original item set.
Answering it feeds a `retention_3d`/`retention_7d` outcome back to the
original teaching decision — this is what "topics to review" (parent
dashboard) is now actually based on, not raw accuracy. To see it without
waiting 3 real days, push a `scheduled_probes.due_at` row into the past
directly in `aura_dev.db` and fetch `next-activity` again.

**Phase 6 (engagement + interventions):** happens automatically too. Answer a
run of wrong items and the next activity fetch may return a short (5-20s)
interlude instead of a lesson — the debug strip's `topic_reason` becomes
`engagement_intervention`. Which of the four (mini_game, interest_injection,
modality_switch, break) appears is chosen the same way as teaching_method/
modality (Thompson sampling); if distress is high enough, it always picks
`break` (the safe default) instead of experimenting. Finishing it returns to
a normal lesson; the FIRST real answer after that measures whether engagement
actually recovered and feeds that back to whichever arm was shown. The parent
dashboard's "Suggested time today" card only appears after at least one full
session has been ended.

**Phase 7 (content bank + interest axis):** also automatic, no new child-facing
screen. `theme` is now assigned the same randomized way as method/modality, so
which of the 4 themes (dino/space/ocean/cars) shows up varies across
activities until the model is confident one works best for that child — check
the debug strip's `decision_types.theme` (`explore`/`exploit`) or just answer
several rounds and watch the theme/prompt change. The child screen's prompt
("How many fish friends?") and the celebration line after a correct answer
now come from `content/bank/theme_content.json`, not a hardcoded string. The
parent dashboard gets a new **Interests** card once there's any evidence —
friendly tiers only (Loves this! / Enjoys this / Still discovering), never a
raw number; the same evidence with real percentages is on the educator
dashboard's existing per-axis view (axis `theme`).

To regenerate the content bank (e.g. after adding a theme, or if Ollama is
installed and you want LLM-generated text instead of the template fallback):

```bash
cd backend && .venv/bin/python -m pytest content/generator/ -v   # validator tests
cd .. && backend/.venv/bin/python content/generator/generate_theme_content.py
```

This is a **one-time offline script**, never called at runtime — the whole
point is zero per-request API cost. It tries a local Ollama model
(`llama3.2`, 3s timeout) if one is running, otherwise silently falls back to
a deterministic template; either way the output is validated (word count,
banned words, no idioms) before being written to
`content/bank/theme_content.json`, which the backend just reads.

**Phase 4 flow (educator/counsellor):** on the registration screen, choose
"Teacher / counsellor" instead of "Parent / guardian" — this routes to a
separate, more detailed dashboard (README §2B) instead of the parent's.
A parent must first grant that educator's account access from their
child's dashboard ("Teacher or counsellor access", by email — the
educator account must already exist). The educator then sees, per child:
domain mastery, and per-axis evidence (trials, accuracy, current winner)
**explicitly labelled as internal model estimates, never a clinical
measurement** — plus controls to lock/unlock a specific teaching option
and to assign a topic (honored by the session API for 24 hours). A lock
set here is genuinely enforced by the live decision engine, not just
displayed — verified by checking the session API directly after locking.

`POST /dev/quickstart` (creates a throwaway parent + child with no login)
still exists for backend testing/curl convenience, but the app itself no
longer uses it — the child screen takes a real `childId` chosen by a
logged-in parent.

**Note on `Platform.OS` base URL** (`app/src/shared/api.ts`): `localhost`
works for web and the iOS simulator; an Android emulator needs `10.0.2.2`
(already handled); a **real tablet** on the same Wi-Fi needs your machine's
LAN IP instead of `localhost` — edit `DEV_HOST` in that file.

A debug strip at the bottom of the child screen shows the live decision
(topic, difficulty, method, modality, and whether each was `explore` or
`exploit`) — remove it once this stops being a research-debugging build.

## Phase 9 (pilot readiness)

**Consent screen additions:** a third toggle, "Include in anonymized
research data", actually does something now — grant it and the child's
pseudonymous session data becomes available via the educator export (below);
revoke it and that export starts returning 403 again immediately. The same
screen has two new buttons: **Export my child's data** (downloads a full,
non-anonymized JSON of everything AURA has recorded — web only for now,
native needs expo-file-system/expo-sharing not yet added) and **Withdraw &
delete all data**, which shows an in-app confirmation panel (not a native
`Alert.alert` — that turned out to be unreliable to trigger/verify on web)
before irreversibly deleting every row tied to that child.

**Offline mode:** answer submission (`app/src/shared/offlineQueue.ts`) never
throws — a network failure queues the answer locally instead of losing it,
using the client-generated `interaction_id` the schema always intended for
this (`app/models/runtime.py`'s `Interaction.id` docstring, since Phase 1).
Fetching a genuinely NEW activity still needs connectivity (the engine picks
it adaptively from the answer that just happened), so the app says "you're
offline, N answers saved, reconnect to keep playing" rather than pretending
to work fully offline. To see the queue in action: open devtools' Network
tab, go offline, answer a `tap`-modality item (drag_drop can't be automated
in a browser anyway, see below), come back online, and check
`localStorage.getItem("aura_offline_answer_queue_v1")` before/after — it
should clear once a `nextActivity`/`submitAnswer` call succeeds again.

**Crash reporting:** any uncaught render error shows a friendly "Something
went wrong" screen instead of a blank page, and reports itself to
`POST /telemetry/crash-reports` (deliberately unauthenticated). No dashboard
for these yet — for now, query the `crash_reports` table directly:
`sqlite3 backend/aura_dev.db "select * from crash_reports order by occurred_at desc limit 10;"`.

**Daily backup:**

```bash
backend/.venv/bin/python -m scripts.backup_db   # writes backend/backups/aura_dev_<timestamp>.db
```

Schedule via cron for a real pilot (see the script's own docstring for the
crontab line). SQLite only — see the script if this project ever moves to
Postgres.

**Educator training sheet:** `docs/EDUCATOR_TRAINING.md` — hand this to
whoever is using the educator dashboard during the pilot, before their first
session.

## Phase 8 (research evaluation)

Not part of the running app — a separate `research/` package that drives the
real backend engine directly against a throwaway in-memory database (no
server, no browser). See `research/README.md` for the full picture;
short version:

```bash
cd /path/to/final-year-project
backend/.venv/bin/pip install -r research/requirements.txt   # matplotlib + scipy, once
backend/.venv/bin/python -m research.run_simulation_study     # AURA vs 5 baselines, ~1-2 min
backend/.venv/bin/python -m research.run_ablation_study        # AURA vs 4 ablations, ~4-5 min
backend/.venv/bin/python -m research.run_significance            # paired significance tests, <1s
backend/.venv/bin/python -m research.replay.run_replay_study       # replay every case in replay/cases/, <1s
backend/.venv/bin/python -m pytest research/tests/ -v                 # sanity tests, <1s
```

Results land in `research/results/` — `RESULTS.md` is the human-written read
of the actual numbers from the last run; re-run the studies and it may need
updating, since both use a randomized simulated population. Replay results
land in `research/replay/results/` instead — one real published case is in
there now (`research/replay/README.md`), alongside the synthetic mechanism
check.

## Known verification gap: drag-and-drop in a browser

The `drag_drop` modality (`app/src/child/DragDropAnswer.tsx`) uses a standard
React Native `PanResponder` + `Animated.ValueXY` drag gesture. This has been
verified to render correctly, but **automated browser mouse-drag simulation
did not reliably deliver a release event that `PanResponder` recognized**
during testing (confirmed via console logging: `onPanResponderRelease` never
fired for a simulated drag, while a real subsequent manual test of the `tap`
modality worked immediately). This looks like a gap between the browser
automation tool's synthetic mouse events and `react-native-web`'s responder
system, not an app bug — the same code is the standard, long-established
pattern for RN drag gestures.

**Action before trusting this in the pilot:** verify `drag_drop` manually
with a real finger on an iOS/Android device or simulator (docs/PLAN.md
Phase 2 acceptance test), not just in a desktop browser.
