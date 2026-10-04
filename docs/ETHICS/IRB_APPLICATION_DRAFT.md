# Research ethics / IRB application — draft

**Status: DRAFT. Not submitted. See `README.md` in this folder for what
must happen before this goes to a real ethics board.**

**Working title:** AURA — a safe, randomized, per-child comparison engine
for adaptive learning technology for autistic children: a pilot evaluation

Every `[PLACEHOLDER]` below needs a real value before submission.

---

## 1. Investigators

| Role | Name | Affiliation | Contact |
|---|---|---|---|
| Principal Investigator | `[PLACEHOLDER]` | `[PLACEHOLDER — institution]` | `[PLACEHOLDER]` |
| Faculty / academic supervisor | `[PLACEHOLDER]` | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| Special educator / BCBA advisor | `[PLACEHOLDER — docs/PLAN.md parallel track]` | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| Partner site contact | `[PLACEHOLDER — see PARTNER_SITE_CHECKLIST.md]` | `[PLACEHOLDER]` | `[PLACEHOLDER]` |

## 2. Summary (plain language)

AURA is a tablet application that teaches early academic skills (starting
with number sense, 1–5) to children aged 4–8, with a particular focus on
autistic children. It presents the same lesson content through a small
number of already-standard classroom variations — for example, a
same-answer-shown-then-fades approach versus a try-then-correct approach to
teaching, or tapping versus dragging as the response method — and randomly
alternates between them for each individual child, in the same way a
teacher already varies their approach when finding what works for a
student. It measures, per child, which variation the child actually learns
faster and retains longer, and increasingly favours whichever one is
working for that specific child. This is a **systematic comparison of
approved teaching options** (see §8) — not a new or experimental
intervention, and not a diagnostic or clinical tool of any kind.

This pilot asks: does this systematic, individual comparison genuinely
identify a better-fitting teaching approach faster, and more reliably, than
either a fixed one-size-fits-all approach or a single expert's one-time
manual assessment?

## 3. Background and rationale

Two independent published studies of autistic children found **opposite**
best-performing conditions (massed vs. distributed practice) across
different children (Majdalany et al., 2014; Haq & Kodak, 2015). A third
found error-correction responses to be **idiosyncratic per child** (Kodak et
al., 2016). Practitioners already do a version of this by hand
("assessment-based instruction", Kodak & Halbur, 2021) — manually, over
weeks, requiring an expert, typically done once. This project automates and
repeats that process safely inside ordinary daily practice, using the same
statistical logic (a within-child randomized comparison) that makes a
clinical trial trustworthy, scaled down to one child and one lesson at a
time.

`[PLACEHOLDER — expand with full citations once docs/EXPERIMENT-DESIGN.md
and the reference library (Zotero, docs/PLAN.md parallel track) exist.]`

## 4. Research questions

1. Does the app's randomized, per-child comparison reach a stable
   correct-seeming answer about which teaching option suits a given child
   faster than a fixed or population-level default?
2. Does it agree with, or diverge from, a manual one-time expert assessment
   of the same child — and if it diverges, in which direction?
3. Are engagement (time on task, session completion, signs of frustration)
   and short-term retention (3–7 day recall) better under the app's
   individualized approach than under a fixed approach?
4. Is the app's automatic safety response (pausing exploration when a
   child's behavioural signals suggest rising distress) actually protective
   in practice, or does it ever get in the way of genuine learning?

Simulation results addressing questions 1–3 in a controlled, fully
synthetic setting already exist (`research/results/RESULTS.md`) and do not
require this pilot or any ethics approval — they involve no real children.
This pilot is what lets those findings be checked against real children's
actual behaviour.

## 5. Study design and setting

Observational/quasi-experimental within-subject design: each participating
child uses the app during their normal instructional time at `[PLACEHOLDER
— partner site]`, for `[PLACEHOLDER — e.g. 4–6 weeks, 3–5 sessions/week,
10–15 minutes/session]`. No child is withheld from any teaching option they
would otherwise receive — every "arm" being compared is drawn from options
already considered standard practice for the participating site (see §8).
Session content adapts automatically to logged mastery, retention, and
engagement; a human educator/counsellor retains override authority at every
step (§9).

## 6. Participants

**Target sample:** `[PLACEHOLDER — docs/PLAN.md suggests 5–10 children]`.

**Inclusion criteria** `[PLACEHOLDER — finalize with the site/advisor]`:
- Age 4–8.
- Enrolled at the partner site and already receiving instruction in early
  numeracy or an equivalent foundational skill.
- Parent/guardian able to provide informed consent in a language they're
  fluent in (translated materials: `[PLACEHOLDER]`).
- No known photosensitive epilepsy or condition contraindicating tablet
  screen use (asked directly during consent, not inferred).

**Exclusion criteria** `[PLACEHOLDER]`:
- A parent, guardian, or the site's own staff believes the child would find
  a tablet-based activity distressing regardless of content.
- Any condition the site's clinical staff flags as needing exclusion.

**Recruitment:** through the partner site's own staff, who identify
families who might be interested and pass along study information — the
research team does not approach families directly or access site records
without the site's own process for this. No incentive is offered for
participation beyond `[PLACEHOLDER — decide: none, or a small non-coercive
token, e.g. a certificate/sticker for the child, unrelated to data
provided]`.

## 7. Procedures

1. Site staff introduce the study to eligible families; interested parents
   receive `PRIVACY_NOTICE.md` and `PARENT_CONSENT_FORM.md`.
2. A researcher (or trained site staff) answers questions and obtains
   signed parental consent. Consent explicitly separates two things a
   parent can independently grant or withhold: use of learning-activity
   data (required to use the app at all), and inclusion of pseudonymous
   data in the published research dataset (optional, withdrawable at any
   time — see `PRIVACY_NOTICE.md`). The app uses no camera or microphone.
3. Before each session, the adult running it checks the child's ongoing
   willingness to participate per `CHILD_ASSENT_GUIDE.md` — this is checked
   every session, not just once at enrollment.
4. The child completes a short (~10–15 minute) tablet session as part of
   their normal instructional time. The app selects teaching method,
   response modality, and interest theme for each activity — some sessions
   randomized for comparison purposes, increasingly favouring whichever
   option the data shows works for that child once enough evidence exists.
5. All interaction data (which option was shown, correctness, response
   time, completion) is logged automatically. No audio, video or
   photographs of the child are recorded: the app uses no camera or
   microphone. (Attention predictions for pictures come from a model that
   sees only the picture, never the child.)
6. The educator/counsellor dashboard shows the participating site's staff
   what the app has learned about each child so far, explicitly labelled as
   internal model estimates rather than a clinical finding (README §2B),
   and lets them lock out any option or assign a topic at any time.
7. At the end of the pilot period, a parent may request their child's full
   data (export) or withdraw the child entirely (with full data deletion)
   at any point during or after the study — this is a real, working feature
   of the app itself (docs/PLAN.md Phase 9), not only a paperwork process.

## 8. What is being compared, and what never is

Framed for the ethics board as: **a systematic comparison of approved
teaching options.** Every option compared is already standard practice for
this population — none is novel or experimental in itself; what's novel is
comparing them systematically, per child, with proper logging.

| Being compared (README §3) | Never randomized |
|---|---|
| Teaching method (e.g. errorless vs. try-then-correct) | *What* the child is taught — always driven by their own mastery and revision need |
| Response modality (e.g. tap vs. drag) | Anything a parent, educator, or clinician has explicitly locked out for this child |
| Interest theme shown on matched material | Anything while the app's own safety signal indicates rising distress (§9) |
| A short re-engagement activity when attention appears to be declining | — |

`[PLACEHOLDER — confirm this list against the actual site's curriculum and
the BCBA/educator advisor's sign-off before submission; this must match
docs/EXPERIMENT-DESIGN.md exactly once that document exists.]`

## 9. Risks, discomforts, and safeguards

This is **minimal-risk** research: a screen-based educational activity
using content and formats already standard for this population, with no
physical intervention, no withheld standard care, and no deception.

| Risk | Likelihood / severity | Safeguard already built into the app |
|---|---|---|
| A teaching option that doesn't suit the child causes frustration before the app "learns" this | Low-moderate / low | Automatic distress-responsive fallback: when behavioural signals (error streak, response-time pattern, abandoned activities) suggest rising distress, the app immediately stops exploring and switches to the safest known option for that child — enforced in the decision engine itself, not just the interface, so no client bug can bypass it (`app/engine/safety.py`) |
| General screen-time / sensory discomfort | Low | Session length is short and adapts to the child's own observed attention span over time; camera is off by default and requires a separate, explicit, revocable consent |
| A parent, educator, or clinician disagrees with an app decision | Low | Every decision is fully overridable — a lock or topic assignment takes effect immediately and is genuinely enforced (README §21) |
| Data privacy / re-identification | Low | See `PRIVACY_NOTICE.md` — pseudonymous research export, minimal personal data collected, parent-controlled export/deletion |
| Perceived stigma from being in a "study about autism" | Low-moderate | No child is described to themselves, peers, or in any material as being assessed, diagnosed, or treated for autism; language throughout follows README §6's non-negotiable guardrails (no diagnostic/clinical claims; never frame the goal as suppressing autistic behaviour) |

**No claim of therapeutic benefit is made or implied to families** — this
is evaluated as an educational technology, not a treatment (README's
"Non-goals": not an LMS, not a diagnostic tool, not a therapy replacement,
README §10-equivalent framing carried through this application).

## 10. Benefits

**To the participating child:** access to a lesson experience that adapts
faster to their own individual learning profile than a fixed curriculum,
during time they would be receiving instruction anyway; no child receives
less instruction or a withheld standard option as a result of participating.

**To the field:** the first (as far as this project's own literature review
has found — `[PLACEHOLDER — confirm during reference library work]`) dataset
directly comparing individualized, randomized teaching-option selection
against fixed and expert-manual baselines for this population, at a scale
(automated, repeatable) manual assessment cannot reach.

## 11. Data management and confidentiality

See `PRIVACY_NOTICE.md` for the parent-facing version of this section; this
is the same information in application-review form.

- **Identifiers collected:** nickname (not necessarily legal name), age in
  year-month only, a guardian's contact details for consent purposes. No
  address, no school ID is included in any research export (README §9).
- **Pseudonymization:** every research-facing export is keyed by an opaque,
  randomly-generated `research_hash`, never the child's name or internal
  database id (`app/services/export_service.py`).
- **Access control:** a parent sees their own child's full record; an
  educator/counsellor sees only what the parent has explicitly granted
  access to, and no recordings of the child exist; the research team sees only
  pseudonymous data, and only for children whose parent has separately
  granted the optional "research use" consent scope, checked by the system
  before every export (`backend/app/api/educator.py`'s
  `export_research_data`).
- **Storage:** `[PLACEHOLDER — describe actual pilot infrastructure: which
  machine/server, who has admin access, whether it's the dev SQLite setup
  or a hardened deployment]`. Daily backups are taken
  (`backend/scripts/backup_db.py`).
- **Retention:** `[PLACEHOLDER — decide and state a concrete retention
  period for identifiable data vs. the anonymized research dataset, per
  your institution's policy]`.
- **Right to withdraw and be forgotten:** a parent can request full,
  permanent deletion of their child's data at any time, including after the
  study ends, and this is implemented as a real, immediate, cascading
  delete across every table the child's activity created — not a
  best-effort or delayed process (`parent_service.withdraw_and_delete_child`,
  tested in `backend/tests/test_pilot_readiness.py`).
- **Publication:** only pseudonymous, aggregated findings are intended for
  publication; no individual child's data is reported in an identifiable
  way. `[PLACEHOLDER — confirm publication venue intent, e.g. IEEE
  Transactions on Learning Technologies / IEEE Access / IEEE ICALT per
  docs/PLAN.md Phase 9.]`

## 12. Consent and assent process

Two-layer, matching the population's developmental stage:

- **Parent/guardian informed consent** (`PARENT_CONSENT_FORM.md`): written,
  signed, before any participation; can be withdrawn at any time with
  immediate effect.
- **Child assent**: children aged 4–8, and especially autistic children who
  may communicate willingness/unwillingness non-verbally or atypically,
  cannot meaningfully provide written informed assent. Assent here means
  **ongoing behavioural willingness**, actively checked before and during
  every session by the adult running it, per `CHILD_ASSENT_GUIDE.md` — not
  a one-time signature. Any sign of reluctance or distress ends the session
  immediately regardless of what the app itself is doing.

## 13. Considerations specific to this population

- Sensory and communication differences mean standard verbal-only assent
  checks are insufficient — `CHILD_ASSENT_GUIDE.md` is written around
  behavioural and, where applicable, augmentative/alternative communication
  (AAC) signals, developed with the site's own staff who know each child,
  not assumed generically.
- No harmless autistic behaviour (e.g. stimming) is ever discouraged,
  flagged, or treated as a "problem" by any part of this study or the
  software itself — this is a non-negotiable project guardrail (README §6),
  not just an ethics-application promise.
- The study's language, in every parent- and child-facing material, avoids
  deficit-based or diagnostic framing throughout.

## 14. Compensation

`[PLACEHOLDER — decide: typically none for minimal-risk educational
research beyond what's already part of instructional time; if anything is
offered, it must be small, non-coercive, and not contingent on the child's
performance or data provided.]`

## 15. Withdrawal

A parent may withdraw their child at any time, for any reason, with no
effect on the child's ongoing instruction at the site. On withdrawal:
already-collected data is, at the parent's choice, either (a) permanently
deleted (the default the app's own UI offers first), or (b) retained in
pseudonymous form only if the parent has separately, explicitly agreed to
that. No pressure is placed on which option a withdrawing parent picks.

## 16. Conflicts of interest

`[PLACEHOLDER — disclose any: e.g. investigator's relationship to the
partner site, any funding source.]`

## 17. Timeline

`[PLACEHOLDER — align with docs/PLAN.md Phase 9's week numbers once a real
start date exists.]`

## Appendices

- Appendix A: `PARENT_CONSENT_FORM.md`
- Appendix B: `CHILD_ASSENT_GUIDE.md`
- Appendix C: `PRIVACY_NOTICE.md`
- Appendix D: `PARTNER_SITE_CHECKLIST.md`
- Appendix E `[PLACEHOLDER]`: letter of support from the partner site
- Appendix F `[PLACEHOLDER]`: CVs of investigators, if required by your board
