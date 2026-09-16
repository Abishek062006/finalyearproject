# Ethics documentation — status and how to use this folder

docs/PLAN.md's parallel track: *"Draft + submit ethics / IRB application"*
(weeks 2–6) and *"Parent consent + assent forms, privacy notice"* (weeks
4–8), both blocking the Phase 9 pilot, not the code.

## What this is, and isn't

Everything in this folder is a **first draft**, written to save the real
work of starting from a blank page — not a submittable, legally sufficient,
or clinically reviewed document. I (the AI assistant that wrote these) am
not a licensed ethics board, IRB, lawyer, clinician, or BCBA, and nothing
here should go to a real ethics committee, a real parent, or a real child
without every item in the checklist below actually happening first.

Every factual claim in these documents (what data is collected, what the
safety mechanisms do, what a parent can control) is grounded in the actual
built system as of this commit — not aspirational. If the code changes,
these documents need to be re-checked against it, not the other way around.

## Before any of this is used for real

- [ ] A real institutional/independent ethics board or IRB has reviewed and
      approved the application (`IRB_APPLICATION_DRAFT.md`) — not just read
      it.
- [ ] A lawyer familiar with your jurisdiction's data protection and
      research-with-minors law has reviewed the consent form, assent guide,
      and privacy notice (`PRIVACY_NOTICE.md`). This draft leans on
      GDPR-style rights language as the most widely-referenced standard —
      your actual jurisdiction may require more, less, or different
      language.
- [ ] A special educator or BCBA (docs/PLAN.md's "advisor" parallel-track
      item) has reviewed the teaching-option comparisons
      (`docs/EXPERIMENT-DESIGN.md` once written, and README §3) and
      confirmed they're all genuinely standard, already-in-use practice for
      this population — the ethics application's framing
      ("systematic comparison of approved teaching options", README §6)
      depends on this being true, not just asserted.
- [ ] A partner school/therapy centre has actually agreed
      (`PARTNER_SITE_CHECKLIST.md`), on their own letterhead/agreement, not
      just this repo's say-so.
- [ ] Every `[PLACEHOLDER]` in every document below has been filled in with
      real, verified information — institution name, IRB name, real contact
      details, jurisdiction-specific legal citations.
- [ ] Someone with real authority to do so has decided who the Data
      Controller / Data Protection Officer (or your jurisdiction's
      equivalent) actually is — these drafts assume a named person exists,
      they don't invent one.

## Folder map

| File | What it's for |
|---|---|
| `IRB_APPLICATION_DRAFT.md` | The application itself — purpose, procedures, risks/benefits, consent process, data management |
| `PARENT_CONSENT_FORM.md` | What a parent/guardian reads and signs before their child participates |
| `CHILD_ASSENT_GUIDE.md` | How to check an autistic 4-8-year-old is willing to participate — not a form the child reads/signs |
| `PRIVACY_NOTICE.md` | Standalone plain-language "what data, why, your rights" document (distinct from the consent form) |
| `PARTNER_SITE_CHECKLIST.md` | Practical checklist for identifying and engaging a partner school/therapy centre |

## Why these are consistent with the rest of the project

Every claim about data handling in these documents matches what
`docs/PLAN.md` Phase 9 actually built, not a promise: a parent can export
their child's full data (`GET /parent/children/{id}/export`) or withdraw and
have it permanently deleted (`DELETE /parent/children/{id}`,
`app/services/parent_service.py`'s `withdraw_and_delete_child`) at any time,
from inside the app itself, with no need to email anyone first (though they
still can). The optional "research use" consent scope is checked before any
pseudonymous data leaves the child's own record — see
`app/services/export_service.py`. None of that is aspirational; it's live
and tested (`backend/tests/test_pilot_readiness.py`).

Language throughout follows README §6's non-negotiable guardrails: never
diagnostic or clinical framing, never a claim to treat or reduce autism,
never suppress harmless autistic behaviour (e.g. stimming) — the stated
goals are communication, self-regulation, independence, participation, and
functional learning, and every document here is written to match that.
