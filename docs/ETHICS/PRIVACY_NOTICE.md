# Privacy notice — draft

**Status: DRAFT. Needs review by a lawyer familiar with your jurisdiction's
data protection law before use — see `README.md` in this folder. Written
in a GDPR-influenced style as the most widely-referenced standard; your
actual jurisdiction may require different or additional content.**

This notice explains what information AURA collects about your child if
they take part in the study, why, who can see it, and what rights you have
over it. It's separate from the consent form (`PARENT_CONSENT_FORM.md`) —
that document is what you sign to agree to take part; this one is a
standing reference you can come back to at any time.

## Who is responsible for this data

`[PLACEHOLDER — the named Data Controller (or your jurisdiction's
equivalent): an institution or person, not "the app".]`
Contact for privacy questions: `[PLACEHOLDER]`

## What we collect, and why

| Data | Why | Required? |
|---|---|---|
| Child's nickname | Shown in the parent/educator dashboards so you can tell your child's profile apart from others you manage | Yes (a nickname, not necessarily a legal name, is enough) |
| Birth year and month only (never a full birthdate) | Age-appropriate content selection | Yes |
| Which teaching approach, response method, and theme were used each activity, and how your child responded (correct/incorrect, response time, whether they finished) | This is the actual research measurement — without it there's no study | Yes |
| A parent/guardian's contact details | To obtain and manage consent | Yes |
| Camera-derived engagement signals (a few numbers, e.g. "attention seemed to dip around minute 8") — **never raw video or images**, and only if you separately opt in | Helps time gentle breaks | No — off by default, opt-in only |
| Crash/error reports if the app breaks (a technical error message, never your child's answers) | Keeping the app working during the pilot | Automatic, unavoidable, but contains no learning data |

We do **not** collect: home address, school records or ID, full legal name
(unless you choose to use one as the nickname), or any data not listed
above.

## Legal basis for processing

`[PLACEHOLDER — state the actual legal basis in your jurisdiction, e.g.
explicit consent under GDPR Art. 6(1)(a) and 9(2)(a) for special category
data if applicable, or your local research-ethics framework's equivalent.
Processing a child's data specifically may require additional safeguards
in your jurisdiction — confirm with legal counsel.]`

## Who can see it

- **You**, for your own child — the full record, always, from your own
  parent dashboard.
- **An educator or counsellor you've specifically granted access to** —
  domain progress and de-identified-from-them-by-default model estimates
  (explicitly labelled as internal estimates, not a clinical finding), never
  raw camera data, and only for as long as you keep that access granted.
- **The research team**, but only pseudonymous data (your child's name and
  nickname replaced with a random code, never included), and only if you've
  separately, optionally agreed to "research use" — a choice you can turn
  on or off at any time, checked automatically before any research export
  happens.
- **No one else.** Data is not sold, and is not shared with any third
  party, advertiser, or other family's account.

## How long we keep it

`[PLACEHOLDER — state a concrete retention period, agreed with your IRB:
e.g. identifiable data deleted N months after the study ends unless you've
separately renewed consent; anonymized research data retained per your
institution's data-retention policy for published research.]`

## Your rights

- **See everything we have.** Export your child's complete record at any
  time, in a standard file format, directly from the app — no need to ask
  anyone first (though you're welcome to).
- **Change your mind on the optional choices** (camera, research use) at
  any time, immediately, from the app.
- **Withdraw and delete everything.** Request full, permanent deletion of
  your child's data at any time — this isn't a slow or manual process on
  our end; it's a real, immediate feature that removes every record tied
  to your child.
- **Ask questions or complain.** Contact `[PLACEHOLDER — PI/DPO contact]`
  first; if unsatisfied, `[PLACEHOLDER — your jurisdiction's data
  protection supervisory authority, e.g. your national/regional data
  protection regulator]`.

## Security

`[PLACEHOLDER — describe actual measures for the pilot deployment: hosting,
who has server access, whether backups are encrypted, etc. Don't overstate
— describe what's actually true of the pilot's real infrastructure.]` No
data is ever sent to a third-party AI/API provider — all adaptive decisions
run on infrastructure under the research team's own control, and any
AI-assisted content in the app was generated once, offline, before the
study, not from your child's live data (docs/PLAN.md Phase 7).

## Children's data specifically

We recognize this is data about a child, and a child who may face
additional vulnerability. Beyond the technical protections above (no name
required, pseudonymous research export, parent-controlled deletion), no
material produced by this study — publications, presentations, or
otherwise — will describe an individual child in an identifiable way, and
none will frame a child's autism or any behaviour as something to diagnose,
treat, or suppress (see README §6 for the project's binding language
guardrails, which this notice and the software itself both follow).

## Changes to this notice

`[PLACEHOLDER — state how you'll notify parents of material changes, e.g.
direct message via the app plus email, before they take effect.]`
