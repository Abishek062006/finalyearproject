# AURA — complete technical report for the IEEE paper

*Per-child causal personalization and autism-specific attention modelling for adaptive learning.*
Every number below is copied from a result file in this repository (paths in §9). Nothing is estimated or projected. Where something has not been run, it says so.

---

## 1. Abstract (draft)

Autistic children respond very differently to the same teaching content, and existing adaptive learning systems either adapt only difficulty or apply one model learned from many children to each individual. We present AURA, an adaptive learning system for autistic children with two contributions. First, a per-child causal personalization engine that runs randomized within-child comparisons of teaching method, response mode, interest theme and re-engagement support, using Thompson sampling with a credible-interval stopping rule, drift re-testing, a distress-triggered safety layer and clinician arm-locks. In a paired simulation of 80 children it reduced cumulative regret by 67% against a static system (8.30 vs 25.09) and was significantly better than all five baselines. Second, an autism-specific visual-attention model (ResNet-50 encoder, multi-scale decoder, typical-attention head plus an explicit difference head) trained on the Saliency4ASD eye-tracking data. In 5-fold cross-validation it predicted autistic children's gaze significantly better than a general children's-attention model on five of six standard metrics, predicted the share of autistic gaze on 924 labelled objects with Spearman ρ = 0.850, and was used to edit learning images, raising predicted attention on the teaching target from 0.030 to 0.066.

## 2. Contributions

| # | Contribution | Status | Evidence |
|---|---|---|---|
| C1 | Per-child causal personalization with a safety layer and clinician override | Built; validated in simulation and one replayed published case | §6.3–6.6 |
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
- **Difficulty.** Levels 1–3 per topic, moved one level per activity from the child's last activity on that topic (accuracy ≥ 0.8 with fast responses steps up; accuracy < 0.55 or slow or repeated attempts steps down). Added after the simulation studies; the simulated child does not model difficulty.
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
| Difficulty-adaptation effectiveness | % of activities in a 70–90% accuracy band | not measured: difficulty was wired into the engine after the simulation studies and the simulator has no difficulty model |
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
| **AURA** | **8.30 ± 7.64** | **91.1** | **0.44** | **91.3** | **+9.4** | **97.5** | **95** |

Significance (Holm-adjusted): AURA is better than all five baselines on regret (d_z: −0.71 vs static, −0.62 correlational, −0.52 population, −0.43 expert, −0.28 heuristic), distress events (all five) and accuracy and completion (all five). On 7-day retention and on reaching mastery it is significantly better than four of five (not heuristic: p = 0.24 and 0.07). On learning gain it is significantly better than four of five (heuristic p = 0.056).

### 6.4 IV-C Adaptive learning analysis
- Across 80 children, accuracy rose from 84.7% (first 10 activities) to 94.2% (last 10) and mean mastery from 0.64 after the first activity to 0.90.
- **Explore, then commit.** Share of decisions made on a confirmed per-child winner, by block of five activities:

| Activities | Teaching method | Response mode | Theme |
|---|---|---|---|
| 1–5 | 0.8% | 0.0% | 0.0% |
| 11–15 | 17.6% | 12.5% | 0.0% |
| 21–25 | 34.9% | 29.1% | 4.8% |
| 36–40 | 53.7% | 35.5% | 9.3% |

The engine commits fastest where effects are largest and slowest on theme (effects 0–0.20), refusing to confirm what the data cannot support.
- **Difficulty.** The rule-based difficulty model steps with performance (§5.1) but was not part of these studies; all 3,165 traced lessons ran at level 1 because it had not yet been wired in. A fixed-versus-adaptive difficulty comparison therefore requires adding difficulty to the simulator and re-running; it is listed as future work, not as a result.

### 6.5 IV-D Interest and interaction personalization
Share of activities using the child's true best arm, first vs last block of five:

| Axis (arms) | Chance | Blocks 1–5 | Blocks 36–40 | Final choice correct |
|---|---|---|---|---|
| Teaching method (2) | 50% | 55.9% | 85.9% | 86.2% (69/80) |
| Response mode (2) | 50% | 50.8% | 78.6% | 81.2% (65/80) |
| Interest theme (4) | 25% | 24.0% | 37.5% | 38.8% (31/80) |

Theme is the weakest: four arms and the smallest simulated effects leave about ten trials per arm in 40 activities. In the real app the parent's interest choices seed the theme prior, which the simulation does not use, so these theme numbers are a lower bound.

### 6.6 IV-E Engagement and intervention analysis
- Mean simulated distress over all lessons: 0.037 (AURA) vs 0.187 (static); distress events per child 0.44 vs 3.21.
- 35 of 3,200 traced activities (1.1%) were interventions. Of nine episodes that started above the distress threshold, seven recovered (78%). Recovery in the main studies: 67% (n = 6 children with episodes) and 97% (n = 8, ablation).

| Intervention | Chosen | Distress before → after |
|---|---|---|
| Favourite thing | 11 | 0.59 → 0.32 |
| Break | 7 | 0.53 → 0.37 |
| Mode switch | 10 | 0.31 → 0.20 |
| Mini-game | 7 | 0.35 → 0.23 |

Two honest findings: with about 0.44 interventions per child the engine cannot gather enough trials to personalize them (the best arm was chosen 11 of 35 times, 31% against 25% chance); and the distress safety layer never triggered in simulation (its ablation was identical to full AURA), so its benefit is untested.

### 6.7 IV-F ablations and the four requested comparisons

Component ablation (48 children × 60 activities):

| Condition | Regret ↓ | Significant vs full? |
|---|---|---|
| Full AURA | 8.74 | n/a |
| No early predictor | 32.06 | yes (d_z = −1.51) |
| No randomization (greedy) | 21.69 | yes (d_z = −0.55, p = 0.0008) |
| No prior | 8.44 | no (p = 0.79) |
| No safety layer | 8.74 | identical (never triggered) |

| Requested comparison | Result | Status |
|---|---|---|
| Fixed vs adaptive difficulty | not run | needs difficulty in the simulator |
| Fixed vs dynamic interests | pinning theme to "dino": regret 8.30 → 9.44, retention 91.1 → 87.9, not significant | measured |
| Fixed vs adaptive interaction mode | pinning mode to "tap": regret 8.30 → 11.03 (Holm p = 0.095), 7-day retention 91.1 → 83.7 (d_z = −0.28, Holm p = 0.031) | measured |
| Without vs with GenAI | not run: simulated children do not read text, so simulation cannot measure it | proposed: educators blind-rate GenAI vs template prompts for clarity, autism-appropriateness and safety, and report the validator's rejection rate |

Replay: on the published single-case study [6] (23 sessions), AURA's stopping rule matched the authors' verdict at session 18, five sessions (22%) earlier.

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
4. The 'hierarchical prior' is a fixed Beta(2,2); removing it changed nothing (p = 0.79), so it should be described as weakly informative.
5. The distress safety layer never triggered in simulation; stress-test with a high-distress population before claiming it adds safety.
6. A known engine issue (the prior is counted twice in the sampling step) should be fixed and all studies re-run before submission.
7. Difficulty adaptation and GenAI assistance have not been evaluated (§6.4, §6.7).
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
