# Phase 7 — autism-specific attention model ("Designing for Autistic Eyes")

Predicts where autistic children look in a picture, trained on the
Saliency4ASD eye-tracking dataset. Our model (`DualSaliencyNet`, see
`model.py`) learns typical children's attention plus an explicit
*difference* head for autistic attention, trained on both groups at once.

One command runs everything — training (5-fold cross-validation + a final
model), evaluation with significance tests, the target-attention and
image-editing studies, ONNX export — and writes `ml/results/REPORT.md`.

## Windows laptop with an NVIDIA GPU (e.g. HP Victus, RTX 3050)

Prerequisites: an up-to-date NVIDIA driver, **Python 3.11** (python.org,
tick "Add python.exe to PATH"), and Git.

Open **Command Prompt** (not PowerShell) and run, one line at a time:

```
git clone https://github.com/Abishek062006/finalyearproject.git
cd finalyearproject
py -3.11 -m venv ml\.venv
ml\.venv\Scripts\activate
python -m pip install --upgrade pip
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
pip install -r ml\requirements.txt
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
```

The last line must print `True NVIDIA GeForce RTX 3050 ...`. If it prints
`False`, the CUDA build didn't install: open https://pytorch.org/get-started/locally/,
choose Stable / Windows / Pip / Python / the newest CUDA, run the `pip install`
command it shows, and check again.

**Dataset** (not in git — its licence forbids sharing): copy the folder
`datasets\saliency4asd\` from the Mac into `finalyearproject\datasets\saliency4asd\`
(it must contain `TrainingData\` and `AdditionalData\`). If you only have the
two `.7z` files, put them there and unpack:

```
python -c "import py7zr; [py7zr.SevenZipFile(f'datasets/saliency4asd/{n}.7z').extractall('datasets/saliency4asd') for n in ('TrainingData','AdditionalData')]"
```

**1. Quick check (a few minutes)** — makes sure everything works end to end:

```
set AURA_SMOKE=1
python -m ml.run_all
set AURA_SMOKE=
```

It must finish with `ALL DONE`. (Its numbers are meaningless — 24 images, 1 epoch.)

**2. The real run:**

```
python -m ml.run_all
```

Leave it running (plug in the charger, stop the laptop sleeping). If it is
interrupted, run the same command again — finished folds are reused. If it
reports running out of GPU memory it halves the batch by itself; to start
smaller: `set AURA_BATCH=4` before the command.

**3. Results:** `ml\results\REPORT.md` (+ `eval.json`, `analysis.json`,
`train_log.txt`). Commit and push them so the Mac gets them:

```
git add ml/results
git commit -m "Phase 7 full run results"
git push
```

Trained weights and the ONNX model stay in `ml\checkpoints\` (git-ignored).
Copy `ml\checkpoints\aura_asd_saliency.onnx` back to the Mac separately (USB
or cloud drive) — the app integration uses it.

## Mac

Same steps with `python3.11 -m venv ml/.venv`, `source ml/.venv/bin/activate`,
`pip install torch torchvision`, and `AURA_SMOKE=1 python -m ml.run_all`.
The first (simpler) model took 2 h 33 min on an Apple GPU; its results are
in `results/saliency_results.md`.
