# Sensitivity of AURA's advantage to the simulated children (research/run_sensitivity.py)

N = 40 children per scenario, 40 activities, paired (each child faces every system as an identical clone). Mean cumulative regret (lower is better); p = paired Wilcoxon signed-rank for AURA vs that system.

| Scenario | AURA regret | Static regret (p) | Heuristic regret (p) | AURA retention % | Static % | Heuristic % | AURA distress events | Static | Heuristic |
|---|---|---|---|---|---|---|---|---|---|
| weak preferences (effects x0.5) | 13.12 | 19.19 (0.003) | 15.13 (0.170) | 60.9 | 49.9 | 52.2 | 2.92 | 6.70 | 4.90 |
| as in the main study (x1) | 11.50 | 28.39 (<0.001) | 14.48 (0.033) | 84.9 | 66.3 | 83.6 | 1.10 | 4.38 | 1.68 |
| strong preferences (effects x2) | 3.47 | 21.89 (0.032) | 6.35 (0.242) | 91.3 | 77.6 | 93.0 | 0.25 | 3.60 | 0.33 |
| easily upset children (distress x2) | 11.17 | 27.83 (<0.001) | 14.84 (0.023) | 81.2 | 63.2 | 79.9 | 1.98 | 4.65 | 2.12 |
| archetype: finds mistakes upsetting | 12.52 | 30.53 (<0.001) | 18.69 (0.016) | 77.8 | 49.6 | 75.4 | 2.17 | 5.55 | 2.88 |
| archetype: slow, steady learner | 19.01 | 35.86 (<0.001) | 26.01 (0.005) | 66.0 | 44.3 | 49.3 | 3.65 | 8.20 | 5.35 |
| archetype: one strongly preferred way of working | 3.95 | 24.52 (0.025) | 6.96 (0.155) | 90.9 | 70.1 | 88.6 | 0.10 | 3.88 | 0.70 |
| archetype: no clear preferences | 8.05 | 9.47 (0.174) | 8.31 (0.347) | 48.9 | 44.8 | 34.8 | 5.33 | 8.65 | 7.42 |
| archetype: capable but very easily overloaded | 7.27 | 22.82 (<0.001) | 12.30 (0.012) | 91.1 | 76.1 | 85.7 | 0.97 | 3.85 | 1.70 |
| mixed population of the five archetypes | 9.47 | 28.88 (0.002) | 14.06 (0.033) | 82.0 | 61.9 | 69.9 | 2.38 | 5.78 | 3.15 |
