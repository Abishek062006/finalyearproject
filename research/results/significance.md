# Paired significance testing

Mechanically generated from `simulation_results.csv` / `ablation_results.csv` (re-run `research/run_significance.py` any time those change — it takes under a second, it does not re-run either study). See `RESULTS.md` for the narrative read of these numbers, including why a real-looking descriptive gap not reaching significance at this sample size is expected, not a failure.

Every test here is PAIRED — each simulated child faced every condition as a clone of the same ground truth under the same random seed (common random numbers), so a per-child difference genuinely isolates the effect of the condition, not noise from comparing different children. p-values are Holm-Bonferroni adjusted within each metric's family of comparisons (5 baselines, or 4 ablations) to control the false-positive rate across that many tests — use the adjusted column to decide significance, not the raw one.

## Simulation study: AURA vs. each condition

**Cumulative regret (lower is better)** — paired t-test and Wilcoxon signed-rank, Holm-adjusted across these 5 comparisons.

| vs AURA | n pairs | mean (AURA) | mean (other) | mean diff | Cohen's d_z | t-test p | Holm-adjusted | Wilcoxon p | Holm-adjusted |
|---|---|---|---|---|---|---|---|---|---|
| static | 80 | 8.30 | 25.09 | -16.79 | -0.71 | 0.0000 | 0.0000 **significant** | 0.0000 | 0.0000 |
| heuristic_adaptive | 80 | 8.30 | 11.70 | -3.39 | -0.28 | 0.0143 | 0.0143 **significant** | 0.0518 | 0.0518 |
| correlational | 80 | 8.30 | 21.25 | -12.95 | -0.62 | 0.0000 | 0.0000 **significant** | 0.0001 | 0.0004 |
| population_level | 80 | 8.30 | 20.54 | -12.24 | -0.52 | 0.0000 | 0.0000 **significant** | 0.0013 | 0.0039 |
| expert_manual | 80 | 8.30 | 15.40 | -7.09 | -0.43 | 0.0003 | 0.0006 **significant** | 0.0066 | 0.0132 |

**7-day retention % (higher is better)** — paired t-test and Wilcoxon signed-rank, Holm-adjusted across these 5 comparisons.

| vs AURA | n pairs | mean (AURA) | mean (other) | mean diff | Cohen's d_z | t-test p | Holm-adjusted | Wilcoxon p | Holm-adjusted |
|---|---|---|---|---|---|---|---|---|---|
| static | 80 | 91.08 | 71.76 | +19.32 | 0.52 | 0.0000 | 0.0001 **significant** | 0.0000 | 0.0002 |
| heuristic_adaptive | 80 | 91.08 | 88.51 | +2.57 | 0.13 | 0.2443 | 0.2443 | 0.2380 | 0.2380 |
| correlational | 80 | 91.08 | 75.82 | +15.26 | 0.44 | 0.0002 | 0.0008 **significant** | 0.0003 | 0.0010 |
| population_level | 80 | 91.08 | 79.66 | +11.43 | 0.38 | 0.0012 | 0.0035 **significant** | 0.0009 | 0.0027 |
| expert_manual | 80 | 91.08 | 80.58 | +10.50 | 0.35 | 0.0022 | 0.0045 **significant** | 0.0018 | 0.0037 |

**Distress events (lower is better)** — paired t-test and Wilcoxon signed-rank, Holm-adjusted across these 5 comparisons.

| vs AURA | n pairs | mean (AURA) | mean (other) | mean diff | Cohen's d_z | t-test p | Holm-adjusted | Wilcoxon p | Holm-adjusted |
|---|---|---|---|---|---|---|---|---|---|
| static | 80 | 0.44 | 3.21 | -2.77 | -0.59 | 0.0000 | 0.0000 **significant** | 0.0000 | 0.0000 |
| heuristic_adaptive | 80 | 0.44 | 0.88 | -0.44 | -0.27 | 0.0171 | 0.0171 **significant** | 0.0090 | 0.0090 |
| correlational | 80 | 0.44 | 2.62 | -2.19 | -0.49 | 0.0000 | 0.0001 **significant** | 0.0000 | 0.0001 |
| population_level | 80 | 0.44 | 2.65 | -2.21 | -0.44 | 0.0002 | 0.0006 **significant** | 0.0006 | 0.0012 |
| expert_manual | 80 | 0.44 | 1.91 | -1.48 | -0.43 | 0.0003 | 0.0006 **significant** | 0.0001 | 0.0003 |

**Reached 80% mastery within the study horizon** — exact McNemar test on paired yes/no outcomes, Holm-adjusted.

| vs AURA | n pairs | rate (AURA) | rate (other) | discordant pairs | McNemar p | Holm-adjusted |
|---|---|---|---|---|---|---|
| static | 80 | 95% | 62% | 26 | 0.0000 | 0.0000 **significant** |
| heuristic_adaptive | 80 | 95% | 88% | 8 | 0.0703 | 0.0703 |
| correlational | 80 | 95% | 71% | 21 | 0.0000 | 0.0001 **significant** |
| population_level | 80 | 95% | 70% | 20 | 0.0000 | 0.0000 **significant** |
| expert_manual | 80 | 95% | 84% | 11 | 0.0117 | 0.0234 **significant** |

**Reached, and kept, the correct decision within the study horizon** — exact McNemar test on paired yes/no outcomes, Holm-adjusted.

| vs AURA | n pairs | rate (AURA) | rate (other) | discordant pairs | McNemar p | Holm-adjusted |
|---|---|---|---|---|---|---|
| static | 80 | 21% | 1% | 16 | 0.0000 | 0.0002 **significant** |
| heuristic_adaptive | 80 | 21% | 6% | 18 | 0.0075 | 0.0302 **significant** |
| correlational | 80 | 21% | 6% | 20 | 0.0118 | 0.0355 **significant** |
| population_level | 80 | 21% | 6% | 20 | 0.0118 | 0.0355 **significant** |
| expert_manual | 80 | 21% | 6% | 20 | 0.0118 | 0.0355 **significant** |

## Ablation study: full_aura vs. each condition

**Cumulative regret (lower is better)** — paired t-test and Wilcoxon signed-rank, Holm-adjusted across these 4 comparisons.

| vs full_aura | n pairs | mean (full_aura) | mean (other) | mean diff | Cohen's d_z | t-test p | Holm-adjusted | Wilcoxon p | Holm-adjusted |
|---|---|---|---|---|---|---|---|---|---|
| no_hierarchical_prior | 48 | 8.74 | 8.44 | +0.30 | 0.04 | 0.7949 | 0.7949 | 0.6076 | 0.6076 |
| no_early_predictor | 48 | 8.74 | 32.06 | -23.32 | -1.51 | 0.0000 | 0.0000 **significant** | 0.0000 | 0.0000 |
| no_safety_layer | 48 | 8.74 | 8.74 | +0.00 | n/a | n/a | n/a | n/a | n/a |
| no_randomization | 48 | 8.74 | 21.69 | -12.95 | -0.55 | 0.0004 | 0.0008 **significant** | 0.0324 | 0.0649 |

**7-day retention % (higher is better)** — paired t-test and Wilcoxon signed-rank, Holm-adjusted across these 4 comparisons.

| vs full_aura | n pairs | mean (full_aura) | mean (other) | mean diff | Cohen's d_z | t-test p | Holm-adjusted | Wilcoxon p | Holm-adjusted |
|---|---|---|---|---|---|---|---|---|---|
| no_hierarchical_prior | 48 | 90.56 | 93.09 | -2.53 | -0.18 | 0.2138 | 0.2138 | 0.2763 | 0.2763 |
| no_early_predictor | 48 | 90.56 | 73.92 | +16.64 | 0.55 | 0.0004 | 0.0011 **significant** | 0.0006 | 0.0018 |
| no_safety_layer | 48 | 90.56 | 90.56 | +0.00 | n/a | n/a | n/a | n/a | n/a |
| no_randomization | 48 | 90.56 | 81.65 | +8.91 | 0.29 | 0.0472 | 0.0945 | 0.0222 | 0.0444 |

**Distress events (lower is better)** — paired t-test and Wilcoxon signed-rank, Holm-adjusted across these 4 comparisons.

| vs full_aura | n pairs | mean (full_aura) | mean (other) | mean diff | Cohen's d_z | t-test p | Holm-adjusted | Wilcoxon p | Holm-adjusted |
|---|---|---|---|---|---|---|---|---|---|
| no_hierarchical_prior | 48 | 0.75 | 0.46 | +0.29 | 0.15 | 0.2905 | 0.5810 | 0.3897 | 0.7795 |
| no_early_predictor | 48 | 0.75 | 2.56 | -1.81 | -0.59 | 0.0002 | 0.0005 **significant** | 0.0002 | 0.0006 |
| no_safety_layer | 48 | 0.75 | 0.75 | +0.00 | n/a | n/a | n/a | n/a | n/a |
| no_randomization | 48 | 0.75 | 0.75 | +0.00 | 0.00 | 1.0000 | 1.0000 | 0.9675 | 0.9675 |

**Reached 80% mastery within the study horizon** — exact McNemar test on paired yes/no outcomes, Holm-adjusted.

| vs full_aura | n pairs | rate (full_aura) | rate (other) | discordant pairs | McNemar p | Holm-adjusted |
|---|---|---|---|---|---|---|
| no_hierarchical_prior | 48 | 92% | 92% | 2 | 1.0000 | 1.0000 |
| no_early_predictor | 48 | 92% | 79% | 8 | 0.0703 | 0.2109 |
| no_safety_layer | 48 | 92% | 92% | 0 | n/a (identical outcomes — no discordant pairs) | n/a |
| no_randomization | 48 | 92% | 79% | 10 | 0.1094 | 0.2188 |

**Reached, and kept, the correct decision within the study horizon** — exact McNemar test on paired yes/no outcomes, Holm-adjusted.

| vs full_aura | n pairs | rate (full_aura) | rate (other) | discordant pairs | McNemar p | Holm-adjusted |
|---|---|---|---|---|---|---|
| no_hierarchical_prior | 48 | 29% | 29% | 16 | 1.0000 | 1.0000 |
| no_early_predictor | 48 | 29% | 8% | 16 | 0.0213 | 0.0425 **significant** |
| no_safety_layer | 48 | 29% | 29% | 0 | n/a (identical outcomes — no discordant pairs) | n/a |
| no_randomization | 48 | 29% | 8% | 14 | 0.0129 | 0.0388 **significant** |

