# AURA pilot study protocol (draft for ethics review)

*Phase 8. This is the one step that needs real people, so it is written to be handed to a supervisor and an ethics committee. Placeholders are in `[brackets]`. Nothing here has been run.*

## 1. Aim and questions

Primary: **can AURA find, for individual autistic children, which teaching method and response mode work best for them, safely, in routine short sessions?**
Secondary:
1. Do children stay engaged and calm (few self-requested breaks, low distress, high completion)?
2. Do the findings AURA states for a child agree with what their teacher or therapist observes?
3. Do teachers and therapists find the dashboard, goals and report usable?
4. (Optional, only if an extra arm is added, see §8) Do pictures edited with the attention model help?

This is a **feasibility and safety pilot**, not a test of effectiveness: the sample is too small for group-level claims.

## 2. Design

- **Within-child randomized alternating-treatments design** (the single-case design AURA automates). Each child acts as their own control; teaching method, response mode and theme are varied randomly across their own activities by the app (as in the simulation studies).
- **Duration:** 4 weeks, 3 sessions a week, 10–15 minutes each (about 12 sessions per child).
- **Setting:** at school or the centre, with an adult present throughout; or at home with a parent, if the family prefers.
- **Two parts:** (A) children (§3); (B) a usability study with teachers, therapists and parents (§7).

## 3. Participants (children)

- **Target:** 5–10 autistic children aged 5–12 who can use a touch screen with or without help, recruited through `[school / therapy centre]`.
- **Included:** a documented autism diagnosis; a parent or guardian who gives informed written consent; the child shows willingness (assent) at each session.
- **Excluded:** a child who becomes distressed at the screen on the first introduction and does not settle with the adult's support; any child whose parent withdraws consent.
- **Sample size:** a feasibility pilot, so no power calculation; analysis is per child. 5–10 children give a first look at whether AURA's per-child verdicts are stable and sensible.

## 4. Procedure

1. Information sheet and consent form (`docs/ETHICS/PARENT_CONSENT_FORM.md`, `PRIVACY_NOTICE.md`), read with the parent; the parent sets up the child in AURA (name or nickname, age, communication level, sensory needs, goals).
2. Introduction session: the child meets their learning friend; no data used for decisions.
3. Sessions: the child plays; an adult stays nearby and may stop at any time. The child can press Break, Help or All done at any moment; an adult exits through the parental gate.
4. Weekly: the teacher or therapist adds a short note and reviews the dashboard.
5. End: parent and teacher interviews and the usability questionnaire (§7).

## 5. Outcomes

Primary (all logged automatically; definitions as in `docs/IEEE_REPORT.md` §6.2):
- Completion rate; self-requested breaks per session; distress events (rising crossings of 0.6); sessions ended early by an adult.
- Per-child confirmed findings (which arm AURA calls best, after how many sessions, and whether it stays stable).

Secondary:
- Learning accuracy and learning gain on the practised topics; 7-day retention probes.
- Response time per item (logged in the app; first real-data measurement of it).
- Share of activities with accuracy in a 70–90% band (the difficulty-adaptation measure that simulation could not provide).
- Teacher agreement: for each stated finding, the teacher marks "matches what I see / does not / not sure".
- Parent-reported ease of use and the child's reaction (free text).

## 6. Analysis plan (fixed in advance)

- **Per child:** the engine's own credible-interval verdicts, and single-case effect sizes (non-overlap of data points between conditions) with the graphs the dashboard already draws.
- **Across children:** descriptive summaries (median, range) of the primary outcomes; the share of children for whom at least one finding was confirmed; the share of teacher "matches".
- No hypothesis tests on group means are planned; if reported, they are labelled exploratory.
- **Success criteria for the pilot:** at least 80% of planned sessions completed; no child's distress events or early endings rising across the 4 weeks; at least one confirmed finding for a majority of children; teacher agreement of at least 70% on confirmed findings; mean usability score of at least 68 (the usual "acceptable" threshold).

## 7. Usability study (adults)

Teachers, therapists and parents use the dashboard, goals, notes and report on a demo family (`backend/scripts/demo_family.py`) or their own pilot child, then complete the System Usability Scale (Brooke, 1996), 10 statements rated 1 (strongly disagree) to 5 (strongly agree):
1. I think that I would like to use this system frequently.
2. I found the system unnecessarily complex.
3. I thought the system was easy to use.
4. I think that I would need the support of a technical person to be able to use this system.
5. I found the various functions in this system were well integrated.
6. I thought there was too much inconsistency in this system.
7. I would imagine that most people would learn to use this system very quickly.
8. I found the system very cumbersome to use.
9. I felt very confident using the system.
10. I needed to learn a lot of things before I could get going with this system.

Plus three open questions: what was confusing, what was missing, what would you change. **This part involves no children** and is the quickest to get approved; it alone removes the "no human evaluation" objection.

## 8. Optional extra: do edited pictures help?

The attention model (`ml/`) can soften distracting backgrounds. To test it with children without any camera, a "picture version" (original vs edited) would be added as a fourth randomized axis, with the same per-child comparison as the other axes. **This axis is not built yet** and needs a decision after the first pilot; the claim in the paper stays "predicted attention", not "measured", until then.

## 9. Safety, ethics and data

- An adult is present at all times; the child can stop or ask for a break at any moment; the app moves to the child's familiar settings when it detects or is told of distress.
- **No camera, microphone or eye tracking** is used; no photos or video of the child are recorded. Photos a parent adds for the Talk board or stories stay on the family's own device.
- Data are pseudonymised (no name or nickname in exports), stored on `[secure server / encrypted laptop]`, and a parent can export or delete everything at any time (the app's withdrawal deletes every row about the child).
- The research-use consent is separate and optional. Approval is needed from `[institution ethics committee]` before any child takes part; a supervisor is responsible for the study.
- The study must stop for a child if distress persists across two sessions despite adult support.

## 10. Timeline (to be filled in with the supervisor)

| Step | Who | When |
|---|---|---|
| Ethics application (adapt `docs/ETHICS/IRB_APPLICATION_DRAFT.md`) | student + supervisor | `[ ]` |
| Agree site and recruit | supervisor | `[ ]` |
| Usability study (adults) | student | can start before ethics for children is approved, subject to the committee |
| Child sessions, 4 weeks | student + site staff | `[ ]` |
| Analysis and write-up | student | `[ ]` |

## 11. What to report, whatever the results

Number approached, consented, completed; every deviation; every adverse event; all primary outcomes for every child, including children for whom nothing was confirmed.
