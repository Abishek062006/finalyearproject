# Educator / counsellor training sheet

For the teacher, counsellor, or BCBA using AURA's educator dashboard during
the pilot (docs/PLAN.md Phase 9). Read this once before your first session
with a child's data — it should take about 10 minutes.

## 1. What AURA is, and isn't

AURA is a tool that runs small, randomized comparisons of teaching method,
interaction style, and interest theme for one specific child, and reports
what it's learned. It is **not** a diagnostic tool, not a therapy
replacement, and it never labels a child's emotional or mental state as
fact. Everywhere you see a percentage or a "winner" on the dashboard, treat
it the way you'd treat any single data source: informative, not final —
your own judgement and the child's actual response always come first.

## 2. Getting access

1. Register your own account at the login screen, choosing **"Teacher /
   counsellor"** (not "Parent / guardian" — the two roles see different
   levels of detail on purpose, so you must register as the right one).
2. You will see nothing until a parent grants you access. Ask the child's
   parent/guardian to open their dashboard → that child → **Privacy &
   consent**, and either use the app's "grant access" flow with your
   registered email, or contact the pilot's technical lead if that flow
   isn't visible to them yet.
3. Once granted, the child appears in **Your children** on your educator
   home screen.

## 3. Reading a child's profile

Open a child to see:

- **Domain mastery** — the same progress-by-area view the parent sees.
- **Per-axis evidence** — one card per thing AURA is comparing for this
  child (teaching method, interaction modality, interest theme, and
  engagement interventions once any have triggered). Each arm shows trials
  and a percentage.

  **This percentage is an internal model estimate, not a clinical
  measurement.** A small number of trials (single digits) means "not
  enough evidence yet" — treat it as noise, not a finding. AURA itself
  agrees: it won't mark an arm as a "current winner" until it has enough
  evidence and the arms are statistically distinguishable, shown as a
  ✓ / confidence badge on the card.

## 4. Locking an arm

If you know (from your own assessment, a parent's report, or a sensory
consideration) that a specific option should never be used for this child —
e.g. a modality that causes frustration regardless of what the data might
eventually show — you can lock it off:

1. Open the child's profile → the relevant axis card → **Lock**.
2. Pick the arm, set it to **not allowed**.
3. This takes effect immediately and is enforced by the same engine that
   picks activities — not just hidden from the UI. AURA will never assign a
   locked arm to that child again until you unlock it.

Use this when you have a real, specific reason. Locking everything defeats
the point of the comparison — if you're unsure, let AURA run a bit longer
first.

## 5. Assigning a topic

You can override what topic a child practices next (e.g. "focus on numbers
this week regardless of what the model would otherwise pick"). This holds
for 24 hours, then AURA returns to its normal priority (educator assignment
→ due revision → lowest mastery).

## 6. Safety behaviour you should know about

- If a child's engagement signals (error streak, response time, abandoning
  activities) suggest rising distress, AURA automatically switches to the
  safest known option and pauses exploration — it does not need you to
  intervene for this to happen, and it happens before you'd typically
  notice from outside.
- A short (5-20 second) re-engagement activity may appear automatically
  when engagement is declining — this is expected behavior, not an error.
- None of this replaces your own judgement or the child's usual support
  plan. If you see something concerning that AURA hasn't responded to, act
  on it the way you normally would — do not wait for the app.

## 7. If something goes wrong technically

- A crash is reported automatically (no PII beyond an opaque child/session
  id) — you don't need to do anything, but tell the pilot's technical
  contact what you were doing when it happened, since the report alone
  won't have that context.
- If the dashboard shows stale-looking data, try reloading before assuming
  something is broken — the underlying decisions are still logged correctly
  either way (docs/PLAN.md's "every decision is auditable" guarantee).

## 8. Data and privacy

- You only see the level of detail described above — never a name beyond
  what the parent chose to share, never raw camera data (camera is off by
  default and requires separate explicit consent from the parent).
- If the pilot needs an anonymized data export for analysis, that is a
  separate step gated on the parent having explicitly granted "research
  use" consent for that specific child — you cannot export a child's data
  without it, and the export itself never contains the child's name.

## 9. Who to contact

Keep the pilot's technical contact's details here before your first
session — this file intentionally doesn't hardcode a name/email since
that's pilot-specific, not part of the codebase.
