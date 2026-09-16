# Partner site checklist — draft

**Status: DRAFT working checklist, not a legal agreement.**
docs/PLAN.md's parallel track: *"Identify a partner special school /
therapy centre"* (weeks 1–3) — *"Everything in Phase 9 depends on it."*
This is the practical side of that; `IRB_APPLICATION_DRAFT.md` §1 and
Appendix E are the formal side.

## What to look for

- Already works with children aged 4–8, several of whom are autistic or
  otherwise neurodivergent, in a setting with some existing structured
  instructional time (special school, therapy centre, inclusive classroom).
- Has staff able to act as the on-site "educator/counsellor" role in the
  app (docs/EDUCATOR_TRAINING.md) — someone who already knows the
  participating children well enough to judge assent (`CHILD_ASSENT_GUIDE.md`)
  and teaching-option appropriateness (`IRB_APPLICATION_DRAFT.md` §8).
- Has, or is willing to get, its own institutional sign-off to participate
  in external research — don't rely on one enthusiastic staff member's
  informal yes.
- Has tablets available, or is willing to have the study provide them, plus
  reliable-enough Wi-Fi for daily sync (a dropped connection mid-session is
  handled gracefully by the app itself — docs/PLAN.md Phase 9's offline
  mode — but the site still needs SOME regular connectivity to sync data
  and pull updates).

## First conversation — what to bring

- A plain-language one-pager (not the full IRB draft) explaining the study,
  what it asks of the site and of families, and what it doesn't
  (`README.md` §2, non-diagnostic framing from README §6).
- A clear answer to "what does my staff need to do" — point to
  `docs/EDUCATOR_TRAINING.md`, which exists precisely so this isn't an
  open-ended commitment.
- A clear answer to "who owns/controls the data" —
  `IRB_APPLICATION_DRAFT.md` §11 and `PRIVACY_NOTICE.md`.

## What needs to be resolved before recruitment starts

- [ ] Site's own ethics/administrative approval to participate (separate
      from your own institution's IRB).
- [ ] A named on-site contact who will hold the "educator" role for
      participating children.
- [ ] Device provisioning: whose tablets, who's responsible for them,
      where they're stored/charged.
- [ ] Network: is there reliable Wi-Fi in the room(s) sessions happen in?
- [ ] A written agreement (MOU or equivalent — `[PLACEHOLDER]`, likely
      needs your institution's research office, not just a handshake)
      covering: data ownership/access, who can pause or end the site's
      participation and how, and what happens to any on-site
      devices/software after the pilot ends.
- [ ] Confirm with the site's own special educator/BCBA-equivalent staff
      that the specific teaching-method/modality/theme options in
      `IRB_APPLICATION_DRAFT.md` §8 really are standard practice at this
      site for these children — don't assume README's general framing
      transfers automatically to every setting.
- [ ] A realistic recruitment plan through the site's own family
      relationships — the research team should not cold-contact families
      directly (`IRB_APPLICATION_DRAFT.md` §6).

## Logistics for the pilot itself

- [ ] Backup schedule agreed and actually running
      (`backend/scripts/backup_db.py`, docs/RUNNING.md Phase 9 section) —
      confirm who's responsible for checking it, not just that it exists.
- [ ] A named person who gets crash-report alerts
      (`docs/RUNNING.md`'s Phase 9 section — there's no dashboard yet, so
      this currently means someone periodically checking the
      `crash_reports` table).
- [ ] Confirm the on-site contact has actually read
      `docs/EDUCATOR_TRAINING.md` before the first real session, not just
      been sent the link.
