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

Run the test suite (5 tests covering the vertical slice + the research
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
