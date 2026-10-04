# Paired significance testing

Mechanically generated from `simulation_results.csv` / `ablation_results.csv` (re-run `research/run_significance.py` any time those change — it takes under a second, it does not re-run either study). See `RESULTS.md` for the narrative read of these numbers, including why a real-looking descriptive gap not reaching significance at this sample size is expected, not a failure.

Every test here is PAIRED — each simulated child faced every condition as a clone of the same ground truth under the same random seed (common random numbers), so a per-child difference genuinely isolates the effect of the condition, not noise from comparing different children. p-values are Holm-Bonferroni adjusted within each metric's family of comparisons (5 baselines, or 4 ablations) to control the false-positive rate across that many tests — use the adjusted column to decide significance, not the raw one.

## Simulation study: AURA vs. each condition

**Cumulative regret (lower is better)** — paired t-test and Wilcoxon signed-rank, Holm-adjusted across these 5 comparisons.

| vs AURA | n pairs | mean (AURA) | mean (other) | mean diff | Cohen's d_z | t-test p | Holm-adjusted | Wilcoxon p | Holm-adjusted |
|---|---|---|---|---|---|---|---|---|---|
| static | 80 | 7.13 | 25.09 | -17.97 | -0.72 | 0.0000 | 0.0000 **significant** | 0.0000 | 0.0000 |
| heuristic_adaptive | 80 | 7.13 | 11.70 | -4.57 | -0.37 | 0.0014 | 0.0014 **significant** | 0.0036 | 0.0036 |
| correlational | 80 | 7.13 | 21.25 | -14.13 | -0.64 | 0.0000 | 0.0000 **significant** | 0.0000 | 0.0001 |
| population_level | 80 | 7.13 | 20.54 | -13.42 | -0.56 | 0.0000 | 0.0000 **significant** | 0.0007 | 0.0013 |
| expert_manual | 80 | 7.13 | 15.40 | -8.27 | -0.48 | 0.0000 | 0.0001 **significant** | 0.0002 | 0.0006 |

**7-day retention % (higher is better)** — paired t-test and Wilcoxon signed-rank, Holm-adjusted across these 5 comparisons.

| vs AURA | n pairs | mean (AURA) | mean (other) | mean diff | Cohen's d_z | t-test p | Holm-adjusted | Wilcoxon p | Holm-adjusted |
|---|---|---|---|---|---|---|---|---|---|
| static | 80 | 87.00 | 71.76 | +15.25 | 0.44 | 0.0002 | 0.0010 **significant** | 0.0003 | 0.0014 |
| heuristic_adaptive | 80 | 87.00 | 88.51 | -1.51 | -0.07 | 0.5356 | 0.5356 | 0.5481 | 0.5481 |
| correlational | 80 | 87.00 | 75.82 | +11.19 | 0.31 | 0.0069 | 0.0278 **significant** | 0.0038 | 0.0154 |
| population_level | 80 | 87.00 | 79.66 | +7.35 | 0.23 | 0.0429 | 0.0857 | 0.0239 | 0.0478 |
| expert_manual | 80 | 87.00 | 80.58 | +6.42 | 0.25 | 0.0253 | 0.0759 | 0.0147 | 0.0441 |

**Distress events (lower is better)** — paired t-test and Wilcoxon signed-rank, Holm-adjusted across these 5 comparisons.

| vs AURA | n pairs | mean (AURA) | mean (other) | mean diff | Cohen's d_z | t-test p | Holm-adjusted | Wilcoxon p | Holm-adjusted |
|---|---|---|---|---|---|---|---|---|---|
| static | 80 | 0.51 | 3.21 | -2.70 | -0.55 | 0.0000 | 0.0000 **significant** | 0.0000 | 0.0001 |
| heuristic_adaptive | 80 | 0.51 | 0.88 | -0.36 | -0.19 | 0.0881 | 0.0881 | 0.0905 | 0.0905 |
| correlational | 80 | 0.51 | 2.62 | -2.11 | -0.46 | 0.0001 | 0.0004 **significant** | 0.0002 | 0.0006 |
| population_level | 80 | 0.51 | 2.65 | -2.14 | -0.42 | 0.0003 | 0.0010 **significant** | 0.0012 | 0.0035 |
| expert_manual | 80 | 0.51 | 1.91 | -1.40 | -0.37 | 0.0013 | 0.0026 **significant** | 0.0024 | 0.0047 |

**Reached 80% mastery within the study horizon** — exact McNemar test on paired yes/no outcomes, Holm-adjusted.

| vs AURA | n pairs | rate (AURA) | rate (other) | discordant pairs | McNemar p | Holm-adjusted |
|---|---|---|---|---|---|---|
| static | 80 | 94% | 62% | 25 | 0.0000 | 0.0000 **significant** |
| heuristic_adaptive | 80 | 94% | 88% | 7 | 0.1250 | 0.1250 |
| correlational | 80 | 94% | 71% | 20 | 0.0000 | 0.0002 **significant** |
| population_level | 80 | 94% | 70% | 23 | 0.0001 | 0.0002 **significant** |
| expert_manual | 80 | 94% | 84% | 10 | 0.0215 | 0.0430 **significant** |

**Reached, and kept, the correct decision within the study horizon** — exact McNemar test on paired yes/no outcomes, Holm-adjusted.

| vs AURA | n pairs | rate (AURA) | rate (other) | discordant pairs | McNemar p | Holm-adjusted |
|---|---|---|---|---|---|---|
| static | 80 | 24% | 1% | 18 | 0.0000 | 0.0000 **significant** |
| heuristic_adaptive | 80 | 24% | 6% | 22 | 0.0043 | 0.0103 **significant** |
| correlational | 80 | 24% | 6% | 20 | 0.0026 | 0.0103 **significant** |
| population_level | 80 | 24% | 6% | 22 | 0.0043 | 0.0103 **significant** |
| expert_manual | 80 | 24% | 6% | 20 | 0.0026 | 0.0103 **significant** |

## Ablation study: full_aura vs. each condition

**Cumulative regret (lower is better)** — paired t-test and Wilcoxon signed-rank, Holm-adjusted across these 4 comparisons.

| vs full_aura | n pairs | mean (full_aura) | mean (other) | mean diff | Cohen's d_z | t-test p | Holm-adjusted | Wilcoxon p | Holm-adjusted |
|---|---|---|---|---|---|---|---|---|---|
| no_hierarchical_prior | 48 | 7.80 | 9.18 | -1.38 | -0.14 | 0.3443 | 0.3443 | 0.4361 | 0.4361 |
| no_early_predictor | 48 | 7.80 | 31.35 | -23.56 | -1.32 | 0.0000 | 0.0000 **significant** | 0.0000 | 0.0000 |
| no_safety_layer | 48 | 7.80 | 7.80 | +0.00 | n/a | n/a | n/a | n/a | n/a |
| no_randomization | 48 | 7.80 | 21.69 | -13.89 | -0.57 | 0.0003 | 0.0005 **significant** | 0.0241 | 0.0481 |

**7-day retention % (higher is better)** — paired t-test and Wilcoxon signed-rank, Holm-adjusted across these 4 comparisons.

| vs full_aura | n pairs | mean (full_aura) | mean (other) | mean diff | Cohen's d_z | t-test p | Holm-adjusted | Wilcoxon p | Holm-adjusted |
|---|---|---|---|---|---|---|---|---|---|
| no_hierarchical_prior | 48 | 83.37 | 90.50 | -7.13 | -0.28 | 0.0603 | 0.1810 | 0.1653 | 0.4960 |
| no_early_predictor | 48 | 83.37 | 85.69 | -2.32 | -0.06 | 0.6635 | 1.0000 | 0.9746 | 0.9906 |
| no_safety_layer | 48 | 83.37 | 83.37 | +0.00 | n/a | n/a | n/a | n/a | n/a |
| no_randomization | 48 | 83.37 | 81.65 | +1.72 | 0.05 | 0.7175 | 1.0000 | 0.4953 | 0.9906 |

**Distress events (lower is better)** — paired t-test and Wilcoxon signed-rank, Holm-adjusted across these 4 comparisons.

| vs full_aura | n pairs | mean (full_aura) | mean (other) | mean diff | Cohen's d_z | t-test p | Holm-adjusted | Wilcoxon p | Holm-adjusted |
|---|---|---|---|---|---|---|---|---|---|
| no_hierarchical_prior | 48 | 0.40 | 0.52 | -0.12 | -0.14 | 0.3481 | 0.4639 | 0.2920 | 0.5445 |
| no_early_predictor | 48 | 0.40 | 2.12 | -1.73 | -0.51 | 0.0009 | 0.0028 **significant** | 0.0002 | 0.0006 |
| no_safety_layer | 48 | 0.40 | 0.40 | +0.00 | n/a | n/a | n/a | n/a | n/a |
| no_randomization | 48 | 0.40 | 0.75 | -0.35 | -0.17 | 0.2320 | 0.4639 | 0.2723 | 0.5445 |

**Reached 80% mastery within the study horizon** — exact McNemar test on paired yes/no outcomes, Holm-adjusted.

| vs full_aura | n pairs | rate (full_aura) | rate (other) | discordant pairs | McNemar p | Holm-adjusted |
|---|---|---|---|---|---|---|
| no_hierarchical_prior | 48 | 94% | 94% | 2 | 1.0000 | 1.0000 |
| no_early_predictor | 48 | 94% | 79% | 7 | 0.0156 | 0.0469 **significant** |
| no_safety_layer | 48 | 94% | 94% | 0 | n/a (identical outcomes — no discordant pairs) | n/a |
| no_randomization | 48 | 94% | 79% | 9 | 0.0391 | 0.0781 |

**Reached, and kept, the correct decision within the study horizon** — exact McNemar test on paired yes/no outcomes, Holm-adjusted.

| vs full_aura | n pairs | rate (full_aura) | rate (other) | discordant pairs | McNemar p | Holm-adjusted |
|---|---|---|---|---|---|---|
| no_hierarchical_prior | 48 | 35% | 27% | 22 | 0.5235 | 0.5235 |
| no_early_predictor | 48 | 35% | 6% | 18 | 0.0013 | 0.0039 **significant** |
| no_safety_layer | 48 | 35% | 35% | 0 | n/a (identical outcomes — no discordant pairs) | n/a |
| no_randomization | 48 | 35% | 8% | 21 | 0.0072 | 0.0144 **significant** |

