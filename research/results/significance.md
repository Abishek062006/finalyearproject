# Paired significance testing

Mechanically generated from `simulation_results.csv` / `ablation_results.csv` (re-run `research/run_significance.py` any time those change — it takes under a second, it does not re-run either study). See `RESULTS.md` for the narrative read of these numbers, including why a real-looking descriptive gap not reaching significance at this sample size is expected, not a failure.

Every test here is PAIRED — each simulated child faced every condition as a clone of the same ground truth under the same random seed (common random numbers), so a per-child difference genuinely isolates the effect of the condition, not noise from comparing different children. p-values are Holm-Bonferroni adjusted within each metric's family of comparisons (5 baselines, or 4 ablations) to control the false-positive rate across that many tests — use the adjusted column to decide significance, not the raw one.

## Simulation study: AURA vs. each condition

**Cumulative regret (lower is better)** — paired t-test and Wilcoxon signed-rank, Holm-adjusted across these 5 comparisons.

| vs AURA | n pairs | mean (AURA) | mean (other) | mean diff | Cohen's d_z | t-test p | Holm-adjusted | Wilcoxon p | Holm-adjusted |
|---|---|---|---|---|---|---|---|---|---|
| static | 24 | 11.56 | 24.36 | -12.80 | -0.62 | 0.0061 | 0.0243 **significant** | 0.0177 | 0.0707 |
| heuristic_adaptive | 24 | 11.56 | 12.27 | -0.71 | -0.05 | 0.7939 | 0.7939 | 0.8314 | 0.8314 |
| correlational | 24 | 11.56 | 23.99 | -12.43 | -0.67 | 0.0032 | 0.0160 **significant** | 0.0074 | 0.0372 |
| population_level | 24 | 11.56 | 20.90 | -9.34 | -0.40 | 0.0642 | 0.1284 | 0.1688 | 0.3376 |
| expert_manual | 24 | 11.56 | 21.00 | -9.44 | -0.54 | 0.0148 | 0.0443 **significant** | 0.0262 | 0.0785 |

**7-day retention % (higher is better)** — paired t-test and Wilcoxon signed-rank, Holm-adjusted across these 5 comparisons.

| vs AURA | n pairs | mean (AURA) | mean (other) | mean diff | Cohen's d_z | t-test p | Holm-adjusted | Wilcoxon p | Holm-adjusted |
|---|---|---|---|---|---|---|---|---|---|
| static | 24 | 82.61 | 65.49 | +17.12 | 0.39 | 0.0710 | 0.3551 | 0.0592 | 0.2959 |
| heuristic_adaptive | 24 | 82.61 | 83.22 | -0.61 | -0.02 | 0.9097 | 0.9097 | 0.6845 | 0.6845 |
| correlational | 24 | 82.61 | 75.62 | +6.99 | 0.20 | 0.3387 | 0.8829 | 0.2603 | 0.5490 |
| population_level | 24 | 82.61 | 74.64 | +7.97 | 0.24 | 0.2582 | 0.8829 | 0.1614 | 0.5490 |
| expert_manual | 24 | 82.61 | 73.01 | +9.60 | 0.26 | 0.2207 | 0.8829 | 0.1373 | 0.5490 |

**Distress events (lower is better)** — paired t-test and Wilcoxon signed-rank, Holm-adjusted across these 5 comparisons.

| vs AURA | n pairs | mean (AURA) | mean (other) | mean diff | Cohen's d_z | t-test p | Holm-adjusted | Wilcoxon p | Holm-adjusted |
|---|---|---|---|---|---|---|---|---|---|
| static | 24 | 0.71 | 3.50 | -2.79 | -0.57 | 0.0107 | 0.0373 **significant** | 0.0096 | 0.0287 |
| heuristic_adaptive | 24 | 0.71 | 1.08 | -0.38 | -0.16 | 0.4398 | 0.4398 | 0.4102 | 0.4102 |
| correlational | 24 | 0.71 | 3.08 | -2.38 | -0.58 | 0.0091 | 0.0373 **significant** | 0.0059 | 0.0238 |
| population_level | 24 | 0.71 | 2.96 | -2.25 | -0.47 | 0.0320 | 0.0641 | 0.0278 | 0.0556 |
| expert_manual | 24 | 0.71 | 3.29 | -2.58 | -0.60 | 0.0075 | 0.0373 **significant** | 0.0036 | 0.0182 |

**Reached 80% mastery within the study horizon** — exact McNemar test on paired yes/no outcomes, Holm-adjusted.

| vs AURA | n pairs | rate (AURA) | rate (other) | discordant pairs | McNemar p | Holm-adjusted |
|---|---|---|---|---|---|---|
| static | 24 | 92% | 58% | 8 | 0.0078 | 0.0391 **significant** |
| heuristic_adaptive | 24 | 92% | 88% | 3 | 1.0000 | 1.0000 |
| correlational | 24 | 92% | 62% | 9 | 0.0391 | 0.1562 |
| population_level | 24 | 92% | 71% | 5 | 0.0625 | 0.1875 |
| expert_manual | 24 | 92% | 71% | 5 | 0.0625 | 0.1875 |

**Reached, and kept, the correct decision within the study horizon** — exact McNemar test on paired yes/no outcomes, Holm-adjusted.

| vs AURA | n pairs | rate (AURA) | rate (other) | discordant pairs | McNemar p | Holm-adjusted |
|---|---|---|---|---|---|---|
| static | 24 | 25% | 4% | 5 | 0.0625 | 0.3125 |
| heuristic_adaptive | 24 | 25% | 12% | 5 | 0.3750 | 0.6562 |
| correlational | 24 | 25% | 8% | 6 | 0.2188 | 0.6562 |
| population_level | 24 | 25% | 8% | 8 | 0.2891 | 0.6562 |
| expert_manual | 24 | 25% | 4% | 5 | 0.0625 | 0.3125 |

## Ablation study: full_aura vs. each condition

**Cumulative regret (lower is better)** — paired t-test and Wilcoxon signed-rank, Holm-adjusted across these 4 comparisons.

| vs full_aura | n pairs | mean (full_aura) | mean (other) | mean diff | Cohen's d_z | t-test p | Holm-adjusted | Wilcoxon p | Holm-adjusted |
|---|---|---|---|---|---|---|---|---|---|
| no_hierarchical_prior | 16 | 6.76 | 8.39 | -1.63 | -0.19 | 0.4549 | 0.4549 | 0.1928 | 0.3856 |
| no_early_predictor | 16 | 6.76 | 31.97 | -25.20 | -1.30 | 0.0001 | 0.0003 **significant** | 0.0000 | 0.0001 |
| no_safety_layer | 16 | 6.76 | 6.76 | +0.00 | n/a | n/a | n/a | n/a | n/a |
| no_randomization | 16 | 6.76 | 19.02 | -12.26 | -0.46 | 0.0861 | 0.1722 | 0.3225 | 0.3856 |

**7-day retention % (higher is better)** — paired t-test and Wilcoxon signed-rank, Holm-adjusted across these 4 comparisons.

| vs full_aura | n pairs | mean (full_aura) | mean (other) | mean diff | Cohen's d_z | t-test p | Holm-adjusted | Wilcoxon p | Holm-adjusted |
|---|---|---|---|---|---|---|---|---|---|
| no_hierarchical_prior | 16 | 90.56 | 89.67 | +0.89 | 0.25 | 0.3332 | 0.6663 | 0.3173 | 0.6346 |
| no_early_predictor | 16 | 90.56 | 71.62 | +18.93 | 0.62 | 0.0261 | 0.0784 | 0.0412 | 0.1237 |
| no_safety_layer | 16 | 90.56 | 90.56 | +0.00 | n/a | n/a | n/a | n/a | n/a |
| no_randomization | 16 | 90.56 | 89.47 | +1.09 | 0.04 | 0.8660 | 0.8660 | 0.5930 | 0.6346 |

**Distress events (lower is better)** — paired t-test and Wilcoxon signed-rank, Holm-adjusted across these 4 comparisons.

| vs full_aura | n pairs | mean (full_aura) | mean (other) | mean diff | Cohen's d_z | t-test p | Holm-adjusted | Wilcoxon p | Holm-adjusted |
|---|---|---|---|---|---|---|---|---|---|
| no_hierarchical_prior | 16 | 1.00 | 0.44 | +0.56 | 0.20 | 0.4348 | 0.8697 | 1.0000 | 1.0000 |
| no_early_predictor | 16 | 1.00 | 3.00 | -2.00 | -0.49 | 0.0699 | 0.2097 | 0.0887 | 0.2660 |
| no_safety_layer | 16 | 1.00 | 1.00 | +0.00 | n/a | n/a | n/a | n/a | n/a |
| no_randomization | 16 | 1.00 | 0.88 | +0.12 | 0.03 | 0.9136 | 0.9136 | 0.5961 | 1.0000 |

**Reached 80% mastery within the study horizon** — exact McNemar test on paired yes/no outcomes, Holm-adjusted.

| vs full_aura | n pairs | rate (full_aura) | rate (other) | discordant pairs | McNemar p | Holm-adjusted |
|---|---|---|---|---|---|---|
| no_hierarchical_prior | 16 | 88% | 81% | 1 | 1.0000 | 1.0000 |
| no_early_predictor | 16 | 88% | 81% | 1 | 1.0000 | 1.0000 |
| no_safety_layer | 16 | 88% | 88% | 0 | n/a (identical outcomes — no discordant pairs) | n/a |
| no_randomization | 16 | 88% | 81% | 3 | 1.0000 | 1.0000 |

**Reached, and kept, the correct decision within the study horizon** — exact McNemar test on paired yes/no outcomes, Holm-adjusted.

| vs full_aura | n pairs | rate (full_aura) | rate (other) | discordant pairs | McNemar p | Holm-adjusted |
|---|---|---|---|---|---|---|
| no_hierarchical_prior | 16 | 12% | 50% | 6 | 0.0312 | 0.0938 |
| no_early_predictor | 16 | 12% | 6% | 3 | 1.0000 | 1.0000 |
| no_safety_layer | 16 | 12% | 12% | 0 | n/a (identical outcomes — no discordant pairs) | n/a |
| no_randomization | 16 | 12% | 6% | 3 | 1.0000 | 1.0000 |

