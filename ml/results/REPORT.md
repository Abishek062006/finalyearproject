# Phase 7 report — autism-specific attention model (Saliency4ASD)

Hardware: Windows-10-10.0.26200-SP0, device cuda (NVIDIA GeForce RTX 3050 Laptop GPU). Total time 2.12 h. 5-fold cross-validation over 300 images (each fold: 240 train / 60 test); every number is on held-out images.

## 1. Predicting autistic children's gaze

| Model | AUC-J | sAUC | NSS | CC | SIM | KLD (lower better) |
|---|---|---|---|---|---|---|
| Centre bias | 0.787 | 0.509 | 1.166 | 0.634 | 0.620 | 0.508 |
| Spectral residual | 0.667 | 0.605 | 0.608 | 0.285 | 0.470 | 0.939 |
| TD-only | 0.826 | 0.631 | 1.791 | 0.808 | 0.704 | 0.381 |
| ASD-only | 0.829 | 0.644 | 1.758 | 0.816 | 0.717 | 0.329 |
| Dual: TD head | 0.827 | 0.631 | 1.787 | 0.806 | 0.703 | 0.368 |
| Dual: ASD head (ours) | 0.831 | 0.642 | 1.773 | 0.824 | 0.721 | 0.315 |

## 1. Predicting typically developing children's gaze

| Model | AUC-J | sAUC | NSS | CC | SIM | KLD (lower better) |
|---|---|---|---|---|---|---|
| Centre bias | 0.830 | 0.517 | 1.456 | 0.665 | 0.609 | 0.524 |
| Spectral residual | 0.684 | 0.613 | 0.677 | 0.274 | 0.431 | 1.084 |
| TD-only | 0.871 | 0.673 | 2.355 | 0.868 | 0.742 | 0.284 |
| ASD-only | 0.864 | 0.672 | 2.145 | 0.826 | 0.702 | 0.336 |
| Dual: TD head | 0.872 | 0.674 | 2.356 | 0.869 | 0.742 | 0.274 |
| Dual: ASD head (ours) | 0.866 | 0.669 | 2.168 | 0.836 | 0.708 | 0.319 |

## 2. Is Dual (ours) significantly better on autistic children's gaze?

Paired Wilcoxon signed-rank tests on per-image scores, Holm-corrected per metric; mean difference (Dual minus other) with 95% bootstrap CI.

| Metric | vs | mean diff [95% CI] | p (Holm) | Dual better & significant |
|---|---|---|---|---|
| AUC-J | Centre | +0.043 [+0.039, +0.047] | <0.001 | yes |
| AUC-J | SpecRes | +0.163 [+0.153, +0.174] | <0.001 | yes |
| AUC-J | TD-only | +0.005 [+0.002, +0.007] | <0.001 | yes |
| AUC-J | ASD-only | +0.002 [-0.000, +0.005] | 0.452 | no |
| sAUC | Centre | +0.133 [+0.124, +0.143] | <0.001 | yes |
| sAUC | SpecRes | +0.038 [+0.029, +0.047] | <0.001 | yes |
| sAUC | TD-only | +0.012 [+0.008, +0.015] | <0.001 | yes |
| sAUC | ASD-only | -0.002 [-0.004, +0.001] | 0.024 | no |
| NSS | Centre | +0.607 [+0.554, +0.659] | <0.001 | yes |
| NSS | SpecRes | +1.165 [+1.099, +1.234] | <0.001 | yes |
| NSS | TD-only | -0.018 [-0.040, +0.005] | 0.048 | no |
| NSS | ASD-only | +0.015 [-0.002, +0.037] | 0.407 | no |
| CC | Centre | +0.190 [+0.173, +0.208] | <0.001 | yes |
| CC | SpecRes | +0.539 [+0.515, +0.564] | <0.001 | yes |
| CC | TD-only | +0.016 [+0.007, +0.026] | <0.001 | yes |
| CC | ASD-only | +0.008 [-0.000, +0.018] | 0.228 | no |
| SIM | Centre | +0.101 [+0.093, +0.110] | <0.001 | yes |
| SIM | SpecRes | +0.251 [+0.241, +0.261] | <0.001 | yes |
| SIM | TD-only | +0.017 [+0.010, +0.023] | <0.001 | yes |
| SIM | ASD-only | +0.004 [-0.001, +0.009] | 0.269 | no |
| KLD | Centre | -0.194 [-0.213, -0.175] | <0.001 | yes |
| KLD | SpecRes | -0.625 [-0.660, -0.591] | <0.001 | yes |
| KLD | TD-only | -0.066 [-0.082, -0.051] | <0.001 | yes |
| KLD | ASD-only | -0.014 [-0.033, -0.002] | 0.084 | no |

Dual's TD head vs the TD-only network on typical children's gaze (does sharing the network cost anything?):

| Metric | mean diff [95% CI] | p |
|---|---|---|
| AUC-J | +0.002 [+0.000, +0.003] | 0.029 |
| sAUC | +0.001 [-0.001, +0.003] | 0.402 |
| NSS | +0.001 [-0.016, +0.023] | 0.483 |
| CC | +0.001 [-0.005, +0.009] | 0.862 |
| SIM | +0.000 [-0.004, +0.005] | 0.609 |
| KLD | -0.010 [-0.022, -0.001] | 0.077 |

## 3. Does the model predict how much autistic children look at an object? (real gaze)

924 labelled objects (faces, people, animals, objects, vehicles, food…). Spearman correlation between predicted and REAL share of autistic gaze on each object, held-out images only.

| Model | Spearman rho | mean abs. error |
|---|---|---|
| Centre | 0.771 | 0.017 |
| TD-only | 0.835 | 0.013 |
| ASD-only | 0.855 | 0.012 |
| Dual-ASD | 0.850 | 0.012 |
| Dual-TD | 0.845 | 0.012 |

Dual rho minus TD-only rho, 95% bootstrap CI: [+0.003, +0.029] (Dual significantly better).

**Where autistic and typical attention differ.** Real ASD-minus-TD gaze share per object, and whether each approach predicts that gap:

- Dual (ASD head minus TD head): rho = 0.180
- Two separate networks (ASD-only minus TD-only): rho = 0.245
- Difference, 95% bootstrap CI: [-0.127, -0.002]

| Object type | n | real ASD share | real TD share | p (Wilcoxon) |
|---|---|---|---|---|
| animal | 70 | 0.039 | 0.031 | 0.080 |
| building | 53 | 0.019 | 0.023 | 0.215 |
| car | 32 | 0.052 | 0.034 | 0.224 |
| face | 224 | 0.008 | 0.005 | <0.001 |
| food | 13 | 0.034 | 0.025 | 0.127 |
| hand | 55 | 0.018 | 0.013 | <0.001 |
| object | 112 | 0.020 | 0.016 | 0.004 |
| people | 245 | 0.043 | 0.033 | <0.001 |
| people background | 14 | 0.019 | 0.005 | 0.030 |
| people group | 34 | 0.043 | 0.036 | 0.131 |
| plant | 29 | 0.021 | 0.016 | 0.072 |
| ship | 8 | 0.015 | 0.015 | 0.742 |
| text | 27 | 0.031 | 0.021 | <0.001 |

## 4. Editing learning images (model-predicted)

272 non-human target objects on held-out images. Everything outside the target is softened (blur + desaturate) with the smallest of four strengths that Dual predicts is enough. Scored by an independent judge: ASD-only network of the same fold (never saw the image; not used to make the edit).

- Predicted share of autistic attention on the target: 0.030 before -> 0.066 after (mean gain 95% CI [+0.029, +0.043], Wilcoxon p <0.001).
- Targets that gained attention: 90%. Strengths used: {'0.25': 5, '0.5': 31, '0.75': 99, '1.0': 137}.
- Caveat: this is a model's prediction of attention on edited images; confirming it needs eye-tracking or learning outcomes with children (pilot).

## 5. Deployable model

ONNX file (not in git; too large and derived from licensed data): `D:\finalyearproject\finalyearproject\ml\checkpoints\aura_asd_saliency.onnx`; input 1x3x240x320 RGB in [0,1], output 1x240x320 probabilities; max relative difference vs PyTorch 3.8e-06.
