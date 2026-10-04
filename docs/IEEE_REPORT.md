# AURA — complete technical report for the IEEE paper

*Per-child causal personalization and autism-specific attention modelling for adaptive learning.*
Every number below is copied from a result file in this repository (paths in §9). Nothing is estimated or projected. Where something has not been run, it says so.

---

## 1. Abstract (draft)

Autistic children respond very differently to the same teaching content, and existing adaptive learning systems either adapt only difficulty or apply one model learned from many children to each individual. We present AURA, an adaptive learning system for autistic children with two contributions. First, a per-child causal personalization engine that runs randomized within-child comparisons of teaching method, response mode, interest theme and re-engagement support, using Thompson sampling with a credible-interval stopping rule, drift re-testing, a distress-triggered safety layer and clinician arm-locks. In a paired simulation of 80 children it reduced cumulative regret by 72% against a static system (7.13 vs 25.09, d_z = −0.72, p < 0.0001) and was significantly better than all five baselines on regret; it had the lowest regret in all ten robustness scenarios, including five synthetic child archetypes. Second, an autism-specific visual-attention model (ResNet-50 encoder, multi-scale decoder, typical-attention head plus an explicit difference head) trained on the Saliency4ASD eye-tracking data. In 5-fold cross-validation it predicted autistic children's gaze significantly better than a general children's-attention model on five of six standard metrics, predicted the share of autistic gaze on 924 labelled objects with Spearman ρ = 0.850, and was used to edit learning images, raising predicted attention on the teaching target from 0.030 to 0.066.

## 2. Contributions

| # | Contribution | Status | Evidence |
|---|---|---|---|
| C1 | Per-child causal personalization with a safety layer and clinician override | Built; validated in simulation (including a robustness study) and one replayed published case | §6.3–6.8 |
| C2 | Autism-specific attention model trained on Saliency4ASD | Built; validated on real held-out gaze | §7 |
| C3 | Attention-guided scoring and editing of learning images | Built; validated by an independent model only (not children) | §7.4 |
| C4 | Closing the loop: C3 proposes pictures, C1 tests per child whether they help | Designed; not yet integrated or piloted | §8 |

## 3. Related work and what is new

| Work | Adapts content | Per-child randomized comparison | Safety layer / clinician override | Autism-specific attention model | Uses attention to redesign images |
|---|---|---|---|---|---|
| ZPDES, Clement et al. [2] | yes (exercise choice) | no | no | no | no |
| Rathod et al. [1] (LinUCB + GenAI) | yes (content) | no | no | no | no |
| Rudovic et al. [3]; Jain et al. [4] | no (perception of affect/engagement) | no | no | no | no |
| Wei et al. [10]; Duan et al. [11] | no | no | no | yes (prediction only) | no |
| Aberman et al. [12] | no | no | no | no (typical attention) | yes |
| **AURA** | **yes** | **yes** | **yes** | **yes** | **yes** |

This table is based on the papers' abstracts and what they describe; several full texts were paywalled, so confirm each cell against the full paper before submission. Published scores of [10] and [11] on Saliency4ASD were not retrieved and are not quoted: they use the challenge's own protocol and are not directly comparable with our cross-validation.

## 4. System overview

AURA is a mobile/web application (Expo/React Native client, FastAPI + SQLite backend) with three spaces: a child space (learning scenes, companion character, picture-communication board, calm corner, visual schedule), a parent space (progress, journal, goals, notes, therapist report) and an educator space (per-child evidence, arm locks, goals, notes). The decision engine is the production code that the research harness drives directly, so every study below is a claim about the shipped system.

## 5. Methods

### 5.1 Personalization engine (C1)
- **Axes and arms.** teaching method {errorless, try-then-correct}; response mode {tap, drag-and-drop}; interest theme {dinosaurs, space, ocean, cars}; and a conditional re-engagement axis {mini-game, favourite-thing, mode switch, break}.
- **Learning.** Each arm keeps a Beta posterior of the child's success; Thompson sampling draws one sample per arm and plays the highest. The prior is a fixed weakly informative Beta(2,2) (it is not learned across children, so we do not call it hierarchical).
- **Stopping rule.** An arm is confirmed for that child only after at least 8 trials and when its 95% credible interval no longer overlaps the runner-up. A confirmed winner is withdrawn if its last 5 outcomes fall more than 0.30 below its lifetime mean (drift re-testing).
- **Early predictor and retention.** Winners are judged on same-day correctness; 3- and 7-day retention probes (half-life regression, R(t) = 2^(−t/h)) check durability.
- **Safety.** Distress = 0.6 × abandonment + 0.4 × min(error streak, 5)/5; at ≥ 0.6 every axis uses the child's safe default. Since Phase 4 the child's own Break and "How do I feel?" presses also raise this level (the maximum of the behavioural and self-reported level; not exercised in simulation). Educators can block any arm (append-only locks).
- **Difficulty.** Levels 1–3 per topic, moved one level per activity from the child's last activity on that topic (accuracy ≥ 0.8 with fast responses steps up; accuracy < 0.55 or slow or repeated attempts steps down). Active in the re-run studies below, but the simulated child's accuracy does not depend on difficulty, so its effect on learning is not measured.
- **Topic choice.** Educator assignment, then a due revision, then lowest mastery within parent goals, with interleaving (a topic from either of the last two lessons sits out) and spacing. This does not affect the studies, which are pinned to the counting topic.

### 5.2 Attention model (C2)
- **Trunk.** ResNet-50 pretrained on ImageNet; features from three depths projected, fused at 1/8 resolution.
- **Heads.** `DualSaliencyNet`: a typical-attention (TD) head and a difference head; logits_ASD = logits_TD + logits_DIFF; each head adds eight learned Gaussian centre-bias maps. Outputs are log-probability maps over pixels.
- **Training.** Loss = KL divergence to the fixation density − CC − 0.1·NSS (plus 10⁻³ L1 on the difference map). Input 240×320, Adam, cosine schedule, horizontal-flip augmentation, flip-averaged test-time prediction, 24 epochs; baselines 20 epochs; mixed precision on CUDA.
- **Deployment.** Exported to ONNX (max relative difference to PyTorch 3.8×10⁻⁶; about 115 ms per image on a laptop CPU).

### 5.3 Scoring and editing (C3)
Target-attention score = share of predicted autistic attention inside the target region. Editing blurs and desaturates everything outside the target with a feathered mask at the smallest of four strengths (0.25–1.0) that the model predicts reaches the goal.

## 6. Experiments for C1 (Section IV)

### 6.1 IV-A Experimental setup
- **Software.** Python 3.11, FastAPI, SQLAlchemy 2, SQLite; app on Expo SDK 57 / React Native 0.86. 124 backend tests and 35 research tests pass.
- **Data.** No real children have used AURA. Learner data are (i) simulated children: each has a hidden best arm per axis, drawn at random so children differ; base ability 0.30–0.55, learning rate 0.25–0.45, method effect +0.08 to +0.30, mode effect +0.05 to +0.25, theme effect 0 to +0.20, distress proneness 0–1; distress lowers accuracy by up to 0.18 and can cause abandonment; and (ii) one real published single-case series (23 sessions) digitised from Öz-Alkoyak & Vuran [6] and replayed.
- **Protocol.** Topic: counting 1–5; 5 items per activity, 3 activities per session, retention probes at 3 and 7 days. Each child faces every condition as an identical clone under common random numbers (paired design).
- **Studies.**

| Study | Children | Activities each | Conditions | Seed |
|---|---|---|---|---|
| Comparative | 80 | 40 | 6 | 42 |
| Component ablation | 48 | 60 | 5 | 43 |
| Trace, learning outcomes, axis ablations | 80 | 40 | AURA / six / three | 42 |
| Robustness (§6.8) | 40 per scenario | 40 | AURA, static, heuristic × 10 scenarios | 44 |
| Replay | 1 real series | 23 sessions | 1 | n/a |

- **Hardware.** Apple A18 Pro laptop, 8 GB, CPU only for the simulations; the attention model was trained on an RTX 3050 Laptop GPU (2.12 h for all folds and the final model).
- **ML models.** Thompson-sampling engine (Beta–Binomial), Bayesian mastery estimate, half-life retention model, rule-based engagement classifier, distress monitor, local Llama 3.2 for prompts with a deterministic template fallback and a safety validator (not evaluated; see §6.7).

### 6.2 IV-B Evaluation metrics

| Requested metric | How measured | Status |
|---|---|---|
| Learning accuracy | % of answered items correct | measured |
| Learning gain | accuracy in last 10 activities − first 10 (percentage points) | measured |
| Completion rate | % of lesson activities not abandoned | measured |
| Response time | ms per item | logged in the app; in simulation derived from P(correct), so not independent evidence; report from a pilot |
| Engagement score | distress events per child (rising crossings of 0.6) and recovery after an intervention | measured |
| Revision effectiveness | 7-day retention-probe accuracy | measured |
| Personalization accuracy | final arm equals the child's true best arm | measured |
| Difficulty-adaptation effectiveness | % of activities in a 70–90% accuracy band | not measured: the simulated child does not model difficulty; measure in the pilot |
| Primary metric | cumulative regret = Σ[P(correct) under the child's best arms − P(correct) under arms used] | measured |

Statistics: paired t-test and Wilcoxon signed-rank for continuous metrics, exact McNemar for yes/no, Holm–Bonferroni correction within each metric's family, Cohen's d_z for effect size.

### 6.3 IV-F (main) Comparative results, 80 children × 40 activities

| System | Regret ↓ | 7-day retention % ↑ | Distress events ↓ | Accuracy % ↑ | Learning gain (pp) ↑ | Completion % ↑ | Reached 80% mastery % ↑ |
|---|---|---|---|---|---|---|---|
| Static | 25.09 | 71.8 | 3.21 | 78.5 | −0.1 | 85.5 | 62 |
| Correlational | 21.25 | 75.8 | 2.62 | 80.5 | +1.8 | 88.2 | 71 |
| Population-level | 20.54 | 79.7 | 2.65 | 81.0 | +2.2 | 88.1 | 70 |
| Expert/manual | 15.40 | 80.6 | 1.91 | 85.3 | +2.0 | 91.8 | 84 |
| Heuristic adaptive | 11.70 | 88.5 | 0.88 | 88.9 | +6.3 | 94.8 | 88 |
| **AURA** | **7.13 ± 8.28** | 87.0 | **0.51** | **92.0** | **+7.9** | **98.0** | **94** |

Significance (paired, Holm-adjusted):
- **Regret:** AURA is significantly better than all five baselines (d_z −0.72 vs static, −0.64 correlational, −0.56 population, −0.48 expert, −0.37 heuristic; all Holm p ≤ 0.0014).
- **Accuracy and completion:** significantly better than all five.
- **Distress events, learning gain, reaching mastery:** significantly better than four of five; not significantly different from the heuristic baseline (p = 0.088, 0.34, 0.125).
- **7-day retention:** significantly higher than static (+15.3 pp) and correlational (+11.2 pp) only. Not significant against population-level (p = 0.086) or expert (p = 0.076), and AURA is 1.5 pp *below* the heuristic baseline (p = 0.54). We therefore do not claim a retention advantage over the stronger baselines.
- **Reaching and keeping the child's true best decision:** AURA 24% vs 1% (static) and 6% (each other baseline), significantly better than all five.

*Note on an earlier draft.* These figures supersede a first run made before a sampling fix in the engine (the population prior had been counted twice). The fix lowered regret (8.30 → 7.13) and raised personalization accuracy (below), but lowered 7-day retention (91.1% → 87.0%), which is why the retention claim above is narrower than in the draft.

### 6.4 IV-C Adaptive learning analysis
- Across 80 children, accuracy rose from 86.7% (first 10 activities) to 94.6% (last 10) under AURA (learning gain +7.9 pp, against −0.1 pp for the static system) and final mastery reached 0.91 (static 0.78).
- **Explore, then commit.** Share of decisions made on a confirmed per-child winner, by block of five activities:

| Activities | Teaching method | Response mode | Theme |
|---|---|---|---|
| 1–5 | 1.3% | 1.0% | 0.0% |
| 11–15 | 14.9% | 12.1% | 1.5% |
| 21–25 | 30.2% | 28.7% | 6.8% |
| 36–40 | 49.6% | 42.1% | 15.5% |

The engine commits fastest where effects are largest and slowest on theme (effects 0–0.20), refusing to confirm what the data cannot support.
- **Difficulty.** The difficulty rule (§5.1) is active in these runs: lessons were served at level 1 (224), level 2 (186) and level 3 (2,761). It reaches level 3 for most lessons because the simulated child's accuracy and speed do not depend on the level. The simulator has no difficulty model, so the effect of adaptive difficulty on learning is *not* measured here, and a fixed-versus-adaptive difficulty comparison is left to the pilot (where response time and the share of activities in a 70–90% accuracy band can be measured on real children).

### 6.5 IV-D Interest and interaction personalization
Share of activities using the child's true best arm, first vs last ten activities:

| Axis (arms) | Chance | First 10 | Last 10 | Final choice correct |
|---|---|---|---|---|
| Teaching method (2) | 50% | 69.2% | 87.9% | 88.8% (71/80) |
| Response mode (2) | 50% | 60.4% | 79.5% | 81.2% (65/80) |
| Interest theme (4) | 25% | 28.5% | 39.8% | 42.5% (34/80) |

Theme is the weakest: four arms and the smallest simulated effects leave about ten trials per arm in 40 activities. In the real app the parent's interest choices seed the theme prior, which the simulation does not use, so these theme numbers are a lower bound.

### 6.6 IV-E Engagement and intervention analysis
- Mean simulated distress over all lessons: 0.033 (AURA) vs 0.187 (static); distress events per child 0.51 vs 3.21 (significantly lower than four of five baselines; heuristic p = 0.088).
- 29 of 3,200 traced activities (0.9%) were interventions. Of six episodes that started above the distress threshold, four recovered (67%). Recovery in the other studies: 67% (n = 6 children with episodes, main study) and 100% (n = 4, ablation); these denominators are small.

| Intervention | Chosen | Distress before → after |
|---|---|---|
| Favourite thing | 6 | 0.39 → 0.24 |
| Break | 4 | 0.37 → 0.22 |
| Mode switch | 12 | 0.33 → 0.22 |
| Mini-game | 7 | 0.47 → 0.36 |

Two honest findings: with about 0.4 interventions per child the engine cannot gather enough trials to personalize them (the child's best intervention was chosen 5 of 29 times, 17%, no better than the 25% expected by chance); and the distress safety layer never triggered in simulation (its ablation was identical to full AURA), so its benefit is untested.

### 6.7 IV-F ablations and the four requested comparisons

Component ablation (48 children × 60 activities):

| Condition | Regret ↓ | Significant vs full? |
|---|---|---|
| Full AURA | 7.80 | n/a |
| No early predictor | 31.35 | yes (d_z = −1.32) |
| No randomization (greedy) | 21.69 | yes (d_z = −0.57, Holm p = 0.0005) |
| No prior | 9.18 | no (p = 0.34) |
| No safety layer | 7.80 | identical (never triggered) |

| Requested comparison | Result | Status |
|---|---|---|
| Fixed vs adaptive difficulty | not measured (simulator has no difficulty model, §6.4) | measure in the pilot |
| Fixed vs dynamic interests | pinning theme to "dino": regret 7.13 → 9.30 (Holm p = 0.071), 7-day retention 87.0 → 85.0; not significant | measured |
| Fixed vs adaptive interaction mode | pinning mode to "tap": regret 7.13 → 10.83 (+3.70, d_z 0.27, Holm p = 0.033, significant); retention (87.6 vs 87.0) and distress events (0.79 vs 0.51, p = 0.45) not significantly different | measured |
| Without vs with GenAI | not run: simulated children do not read text, so simulation cannot measure it | proposed: educators blind-rate GenAI vs template prompts for clarity, autism-appropriateness and safety, and report the validator's rejection rate |

Replay: on the published single-case study [6] (23 sessions), AURA's stopping rule matched the authors' verdict at session 18, five sessions (22%) earlier.

### 6.8 Robustness to how the simulated children are built
Does AURA's advantage depend on our choice of simulated children? We re-ran the comparison (40 children per scenario, 40 activities, seed 44, paired) with preference strengths halved and doubled, distress doubled, five named synthetic archetypes, and a mixed population of them. The archetypes are illustrative parameter settings written by us from commonly described patterns; they are *not* derived from data on real children and are not evidence about real autistic children. They only show the result does not hinge on one kind of simulated child.

| Scenario | AURA regret | Static (p) | Heuristic (p) | AURA retention % | Heuristic retention % |
|---|---|---|---|---|---|
| Weak preferences (×0.5) | 13.12 | 19.19 (0.003) | 15.13 (0.17) | 60.9 | 52.2 |
| As in main study | 11.50 | 28.39 (<0.001) | 14.48 (0.033) | 84.9 | 83.6 |
| Strong preferences (×2) | 3.47 | 21.89 (0.032) | 6.35 (0.24) | 91.3 | 93.0 |
| Distress ×2 | 11.17 | 27.83 (<0.001) | 14.84 (0.023) | 81.2 | 79.9 |
| Finds mistakes upsetting | 12.52 | 30.53 (<0.001) | 18.69 (0.016) | 77.8 | 75.4 |
| Slow, steady learner | 19.01 | 35.86 (<0.001) | 26.01 (0.005) | 66.0 | 49.3 |
| One strongly preferred way of working | 3.95 | 24.52 (0.025) | 6.96 (0.155) | 90.9 | 88.6 |
| No clear preferences | 8.05 | 9.47 (0.17) | 8.31 (0.35) | 48.9 | 34.8 |
| Capable but easily overloaded | 7.27 | 22.82 (<0.001) | 12.30 (0.012) | 91.1 | 85.7 |
| Mixed population of the five | 9.47 | 28.88 (0.002) | 14.06 (0.033) | 82.0 | 69.9 |

AURA had the lowest regret in all ten scenarios. It was significantly better than the static app in nine of ten (not when children have no clear preferences, where there is little to find) and than the heuristic baseline in six of ten (not when preferences are weak, very strong or absent). p-values are raw paired Wilcoxon tests, not corrected for the ten scenarios. AURA's retention was higher than the heuristic baseline's in nine of ten scenarios but lower when preferences are strong (91.3 vs 93.0), so a retention advantage over the heuristic is not claimed.

## 7. Experiments for C2 and C3

### 7.1 Data and protocol
Saliency4ASD [8, 9]: 300 images (from MIT1003), each viewed for 3 s by 14 autistic and 14 typically developing children aged 5–12 (Tobii T120), with fixation points, fixation density maps and 924 object boxes (face, people, animal, object, hand, building, car, text, food…). Five-fold cross-validation with fixed seeds: each fold trains on 240 images and tests on 60 never seen in training; all 300 are tested. Models compared on identical folds: centre bias (mean training fixation map), spectral residual (a classic bottom-up saliency model), TD-only, ASD-only and Dual (ours). Metrics: AUC-Judd, shuffled AUC, NSS, CC, SIM, KLD (Bylinskii et al.), computed at original resolution against each group's real gaze.

### 7.2 Predicting autistic children's gaze (held-out images)

| Model | AUC-J ↑ | sAUC ↑ | NSS ↑ | CC ↑ | SIM ↑ | KLD ↓ |
|---|---|---|---|---|---|---|
| Centre bias | 0.787 | 0.509 | 1.166 | 0.634 | 0.620 | 0.508 |
| Spectral residual | 0.667 | 0.605 | 0.608 | 0.285 | 0.470 | 0.939 |
| TD-only | 0.826 | 0.631 | 1.791 | 0.808 | 0.704 | 0.381 |
| ASD-only | 0.829 | 0.644 | 1.758 | 0.816 | 0.717 | 0.329 |
| **Dual, ASD head** | **0.831** | 0.642 | 1.773 | **0.824** | **0.721** | **0.315** |

Paired Wilcoxon tests on per-image scores (Holm-corrected, mean difference [95% bootstrap CI]):
- **Dual vs TD-only:** significantly better on AUC-J (+0.005 [+0.002, +0.007]), sAUC (+0.012 [+0.008, +0.015]), CC (+0.016 [+0.007, +0.026]), SIM (+0.017 [+0.010, +0.023]) and KLD (−0.066 [−0.082, −0.051]), all p < 0.001. On NSS the TD-only model is marginally better (Dual −0.018 [−0.040, +0.005], Holm p = 0.048).
- **Dual vs ASD-only:** no significant difference on AUC-J, NSS, CC, SIM or KLD; ASD-only is marginally better on sAUC (Dual −0.002 [−0.004, +0.001], Holm p = 0.024). We do not claim an advantage over training on autistic gaze alone.
- **Dual vs centre bias and spectral residual:** significantly better on every metric (p < 0.001).
- **Cost of sharing the network:** on typical children's gaze, Dual's TD head is equal to the TD-only network on sAUC, NSS, CC, SIM and KLD (best case KLD −0.010, Holm p = 0.077) and marginally better on AUC-J (+0.002 [+0.000, +0.003], Holm p = 0.029), so sharing one network costs nothing. Each model's best target is its own group (the TD-only model leads on typical gaze, the autism-trained models on autistic gaze), supporting that attention differs between groups [7].

### 7.3 Object-level target attention (real gaze)
Spearman correlation between a model's predicted share of attention inside an object box and the real share of autistic gaze, over 924 held-out objects:

| Model | Spearman ρ | Mean absolute error |
|---|---|---|
| Centre bias | 0.771 | 0.017 |
| TD-only | 0.835 | 0.013 |
| ASD-only | 0.855 | 0.012 |
| Dual (ASD head) | 0.850 | 0.012 |

Dual minus TD-only: ρ difference 95% CI [+0.003, +0.029], i.e. a small but significant improvement.

**Negative result (not a contribution).** The difference head was meant to predict where autistic and typical attention diverge. Against the real per-object gap, Dual's ASD-minus-TD prediction gave ρ = 0.180 versus 0.245 for two separately trained networks (difference CI [−0.127, −0.002]); the explicit difference head is therefore not better than the simpler approach. Its practical value is only that one network serves both groups. Per-object share comparisons between groups should not be read as "autistic children look more at faces": autistic gaze is more dispersed overall, which inflates their share on small objects.

### 7.4 Editing (C3)
On 272 held-out non-human target objects (animal, object, car, food, plant, vehicle), edits were chosen with the fold's Dual model and scored by an independent judge, the same fold's ASD-only network, which never saw the image and was not used to make the edit. Predicted share of autistic attention on the target: 0.030 before → 0.066 after (mean gain 95% CI [+0.029, +0.043], Wilcoxon p < 0.001); 90% of targets gained. Strengths used: 0.25 (5), 0.5 (31), 0.75 (99), 1.0 (137). This is a model's prediction on edited images; it is not eye-tracking evidence.

## 8. Putting it together, and the claim we can make
The ONNX model (97 MB) predicts an attention map for any picture in about 115 ms on a laptop CPU and needs no camera: it sees only the picture, never the child. It can be used in the backend to rank candidate interest photos by target-attention score and to soften distracting backgrounds, with C1 then testing per child, from the child's own answers, whether the edited or original picture helps. That last step is designed but not yet integrated or piloted.

**Claim supported by the data:** an autism-specific attention model, validated on real held-out autistic gaze, outperforms a general children's-attention model and can be used to alter learning images to concentrate predicted attention on the teaching target; and an engine that randomizes and tests options inside each child's own sessions finds each child's best options more reliably and calmly than adaptive baselines in simulation.

## 9. Limitations and threats to validity
1. C1 evidence is from simulated children (hidden ground truth) and one replayed published case; no real-child data yet. Effect-size ranges in the simulator are plausible, not fitted; a sensitivity analysis (halving and doubling effects) should be added.
2. The editing result is a model prediction. Confirmation needs eye-tracking or learning outcomes with children (pilot, ethics approval).
3. The attention model predicts the average autistic child (14 children), not an individual; the dataset is small (300 images).
4. The 'hierarchical prior' is a fixed Beta(2,2); removing it changed nothing (p = 0.34), so it is described as weakly informative.
5. The distress safety layer never triggered in simulation; stress-test with a high-distress population before claiming it adds safety.
6. The engine's Thompson-sampling step previously counted the prior twice; this was fixed and every simulation study was re-run, so all §6 numbers come from the corrected engine.
7. Adaptive difficulty is active in the engine but its effect on learning is not measured, because the simulated child does not model difficulty; GenAI assistance has not been evaluated (§6.4, §6.7). No retention advantage over the heuristic adaptive baseline is claimed (§6.3, §6.8).
8. Published scores of related autism saliency models were not compared on our protocol.
9. No camera, video or eye tracking of the app's users is used; the consent form should say so (the unused camera switch in the Privacy screen should be removed).

## 10. Reproducibility
- Simulation studies: `research/` (`run_simulation_study.py`, `run_ablation_study.py`, `run_significance.py`, `run_trace_analysis.py`, `run_learning_outcomes.py`, `run_axis_ablation.py`); results in `research/results/`.
- Attention model: `ml/` (`python -m ml.run_all`; details in `ml/README.md`); results in `ml/results/REPORT.md`, `eval.json`, `analysis.json`. Dataset (not redistributable) from https://zenodo.org/records/13960426.
- Hardware for the reported ML run: NVIDIA GeForce RTX 3050 Laptop GPU, PyTorch 2.11 (CUDA 12.8).

## 11. References (each checked against Crossref or the publisher page)
[1] V. Rathod, R. Goudar, S. Sangani, "Unified interpretable AI for autism diagnosis and scalable severity-aware personalized adaptive e-learning," *Discover Applied Sciences*, vol. 8, art. 349, 2026, doi:10.1007/s42452-026-08335-4.
[2] B. Clement, D. Roy, P.-Y. Oudeyer, M. Lopes, "Multi-armed bandits for intelligent tutoring systems," *J. Educational Data Mining*, vol. 7, no. 2, pp. 20–48, 2015.
[3] O. Rudovic, J. Lee, M. Dai, B. Schuller, R. Picard, "Personalized machine learning for robot perception of affect and engagement in autism therapy," *Science Robotics*, vol. 3, eaao6760, 2018.
[4] S. Jain, B. Thiagarajan, Z. Shi, C. Clabaugh, M. Matarić, "Modeling engagement in long-term, in-home socially assistive robot interventions for children with autism spectrum disorders," *Science Robotics*, vol. 5, eaaz3791, 2020.
[5] S. Perochon et al., "Early detection of autism using digital behavioral phenotyping," *Nature Medicine*, vol. 29, pp. 2489–2497, 2023.
[6] H. Öz-Alkoyak, S. Vuran, "Distributed and massed practices in teaching concepts to children with autism," *Ankara Üniv. Eğitim Bilimleri Fak. Özel Eğitim Dergisi*, vol. 26, no. 3, pp. 331–345, 2025, doi:10.21565/ozelegitimdergisi.1464202.
[7] S. Wang et al., "Atypical visual saliency in autism spectrum disorder quantified through model-based eye tracking," *Neuron*, vol. 88, pp. 604–616, 2015.
[8] H. Duan, G. Zhai, X. Min, Z. Che, Y. Fang, X. Yang, J. Gutiérrez, P. Le Callet, "A dataset of eye movements for the children with autism spectrum disorder," *Proc. ACM MMSys*, pp. 255–260, 2019.
[9] J. Gutiérrez, Z. Che, G. Zhai, P. Le Callet, "Saliency4ASD: Challenge, dataset and tools for visual attention modeling for autism spectrum disorder," *Signal Processing: Image Communication*, vol. 92, 116092, 2021.
[10] W. Wei et al., "Predicting atypical visual saliency for autism spectrum disorder via scale-adaptive inception module and discriminative region enhancement loss," *Neurocomputing*, vol. 453, pp. 610–622, 2021.
[11] H. Duan et al., "Atypical Salient Regions Enhancement Network for visual saliency prediction of individuals with autism spectrum disorder," *Signal Processing: Image Communication*, vol. 115, 116968, 2023.
[12] K. Aberman et al., "Deep Saliency Prior for reducing visual distraction," *Proc. IEEE/CVF CVPR*, pp. 19819–19828, 2022.
[13] M. Jiang, S. Huang, J. Duan, Q. Zhao, "SALICON: Saliency in context," *Proc. IEEE CVPR*, 2015.
[14] L. Itti, C. Koch, E. Niebur, "A model of saliency-based visual attention for rapid scene analysis," *IEEE Trans. PAMI*, vol. 20, no. 11, 1998.
[15] Z. Bylinskii, T. Judd, A. Oliva, A. Torralba, F. Durand, "What do different evaluation metrics tell us about saliency models?," *IEEE Trans. PAMI*, vol. 41, no. 3, 2019 (metric definitions; not re-checked against Crossref in this project).
[16] X. Hou, L. Zhang, "Saliency detection: a spectral residual approach," *Proc. IEEE CVPR*, 2007 (baseline; not re-checked against Crossref in this project).
