# Autism-specific attention prediction — Saliency4ASD, 5-fold cross-validation

Every number is on images the model never saw in training (60 per fold, all 300 covered). ↑ higher is better, ↓ lower is better.

## Predicting autistic (ASD) children's gaze

| Model | AUC-J ↑ | sAUC ↑ | NSS ↑ | CC ↑ | SIM ↑ | KLD ↓ |
|---|---|---|---|---|---|---|
| Centre | 0.787 | 0.509 | 1.166 | 0.634 | 0.620 | 0.508 |
| SpecRes | 0.667 | 0.605 | 0.609 | 0.285 | 0.470 | 0.939 |
| TD | 0.825 | 0.629 | 1.779 | 0.805 | 0.701 | 0.390 |
| ASD | 0.829 | 0.644 | 1.762 | 0.819 | 0.719 | 0.328 |
| TD→ASD | 0.830 | 0.642 | 1.761 | 0.822 | 0.721 | 0.316 |

## Predicting typically developing (TD) children's gaze

| Model | AUC-J ↑ | sAUC ↑ | NSS ↑ | CC ↑ | SIM ↑ | KLD ↓ |
|---|---|---|---|---|---|---|
| Centre | 0.830 | 0.517 | 1.456 | 0.665 | 0.609 | 0.524 |
| SpecRes | 0.684 | 0.613 | 0.677 | 0.274 | 0.431 | 1.084 |
| TD | 0.870 | 0.672 | 2.343 | 0.865 | 0.739 | 0.291 |
| ASD | 0.865 | 0.673 | 2.139 | 0.827 | 0.702 | 0.333 |
| TD→ASD | 0.865 | 0.669 | 2.144 | 0.831 | 0.703 | 0.328 |
