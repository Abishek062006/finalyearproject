# AURA

**Adaptive Understanding and Responsive AI Framework for Neurodivergent Children**

A research-oriented tablet learning platform for children aged 4–8, with a focus on
autistic children. Three experiences: **Child**, **Parent**, **Teacher/Counsellor**.

---

## 1. One-line idea

> Other adaptive systems **watch** a child and guess what suits them.
> AURA **safely tests** its own decisions on each child, measures the effect, keeps
> what works, and re-tests when the child changes.

## 2. The research contribution

AURA treats every presentation decision as an **N-of-1 (single-child) adaptive
experiment** run inside ordinary lessons.

Instead of concluding "this child likes dinosaurs" from click counts (which is
confounded — the dinosaur items may simply have been easier), AURA teaches two
**matched** item sets the same day under different conditions, in random order, and
measures the difference, including memory 3–7 days later.

**Contributions for the paper**

1. **Formulation** — adaptation as a *constrained N-of-1 contextual bandit* with
   delayed, multi-objective outcomes: mastery + 7-day retention + engagement − distress.
2. **Algorithm** — hierarchical Thompson sampling with
   (a) a **distress budget** (exploration pauses when distress rises),
   (b) a **therapist-bounded action space** (adults lock/unlock options),
   (c) an **early-outcome predictor** that ends comparisons in days, not weeks,
   (d) **drift-triggered re-testing** when a previous winner stops working.
3. **System** — the full tablet platform plus an *experiment-grade logging schema*
   that makes every session analysable after the fact.
4. **Evaluation** — against 5 baselines: static, heuristic-adaptive, correlational
   personalization, population-level policy, expert-manual comparison.

### What is NOT claimed as novel
Adaptive difficulty, interest personalization, spaced revision, engagement detection,
intervention selection, "adapting many things at once". All of these already exist.
**The novelty is the safe, randomized, per-child comparison — protect it.**

### Why per-child testing is justified (evidence)
- Two published studies on autistic children found **opposite** winners for massed vs
  distributed practice (Majdalany et al. 2014; Haq & Kodak 2015).
- Error-correction responses are described as **idiosyncratic per child** (Kodak et al. 2016).
- An RCT (n=28) found errorless and error-correction both work, but outcomes differ by child.
- Therapists already do this by hand ("assessment-based instruction", Kodak & Halbur 2021):
  **manual, weeks long, needs an expert, done once.** AURA automates and repeats it.

## 3. What gets tested — and what never does

| Axis | Options compared | Outcome measured |
|---|---|---|
| Teaching method | errorless vs try-then-correct; hint type; fade speed | trials to mastery, 3/7-day retention |
| Interaction mode | drag-drop / tap / match / flashcard / voice | accuracy, response time, completion |
| Interest theme | top 2–3 themes on matched items | engagement, completion, accuracy |
| Practice structure | massed vs mixed | mastery speed **and** retention |
| Difficulty band | target success 70 / 80 / 90 % | learning speed vs distress |
| Engagement intervention | mini-game / interest injection / modality switch / break | engagement recovery within 60 s |
| Session length | stop rules | engagement decay, end-of-session distress |

**Never randomized:** *what* the child learns (always driven by mastery + revision need),
anything a therapist has locked, anything while distress is rising.

## 4. Datasets

**The core engine needs no training dataset — it learns online from each child.**
Public data is used for the supporting models and for evaluation.

| Need | Source | Status |
|---|---|---|
| Retention / forgetting model | FSRS-Anki-20k, anki-revlogs-10k | free, public (adults) |
| Knowledge tracing development | ASSISTments, EdNet, Eedi (NeurIPS 2020), XES3G5M | free (older students) |
| Engagement in autistic children | Engagnition (n=57, figshare) | free |
| Affect in autistic children (optional camera) | ASC-emotion (Kaggle), CALMED (on request), LIRIS-CSE | free / on request |
| **Teaching-method → outcome per autistic child** | **does not exist** | filled by simulation + graph replay + our pilot |

**Filling the gap (2 of 3 need no children):**
1. **Simulation** — simulated children whose best method differs.
2. **Replay** — digitize session-by-session graphs from published single-case studies
   (PlotDigitizer is free and validated for this), replay them through the algorithm:
   *would AURA have reached the same verdict, sooner?*
3. **Pilot** — 5–10 children at a partner school; this dataset becomes a contribution.

## 5. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Child app + dashboards | **Expo (React Native + react-native-web)**, TypeScript | one codebase → iPad, Android tablet, and browser demos |
| Backend | **FastAPI** (Python 3.11) | research code and API in one language |
| DB | **PostgreSQL** (Docker locally, Supabase free tier later) | relational logging, easy analysis |
| ML / research | numpy, scipy, scikit-learn, pandas; PyTorch later | free |
| Bayesian engine | conjugate Beta-Binomial + hierarchical priors first; PyMC if needed | interpretable, fast |
| Content generation | **local LLM (Ollama) at build time → JSON content bank** | zero runtime API cost |
| Analysis | Jupyter notebooks, matplotlib | paper figures |

No paid APIs. No cloud GPU required.

## 6. Language and claims guardrails (non-negotiable)

Never say AURA diagnoses autism, emotions or mental health; treats or reduces autism;
measures intelligence or attention span clinically.

Say: *adaptive learning, estimated engagement, observed interaction behaviour,
learning retention estimate, educational recommendation, contextual affect signal.*

Never suppress harmless autistic behaviour (e.g. stimming). Goals are communication,
self-regulation, independence, participation, functional learning.

In the ethics application, describe the comparisons as
*"systematic comparison of approved teaching options"* — every option is already
standard classroom practice.

## 7. Naming note

A 2026 HCI International paper also uses the name **AURA** for an emotion-aware system
for autistic children. Cite it and state the difference explicitly, or rename.

---

See [docs/PLAN.md](docs/PLAN.md) for the phase-by-phase build plan.
