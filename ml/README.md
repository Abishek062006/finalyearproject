# Phase 7 — autism-specific attention model ("Designing for Autistic Eyes")

Predicts where autistic children look in a picture, trained on the
Saliency4ASD eye-tracking dataset. See `train.py` for the experiment design.

## Results so far (MacBook, Apple GPU, 2 h 33 min)

`results/saliency_results.md` — 5-fold cross-validation, 300 images.

## Running on another computer (e.g. Windows laptop with an NVIDIA GPU)

1. **Code:** clone or copy this repository.
2. **Dataset (not in git — its licence forbids sharing):** copy the folder
   `datasets/saliency4asd/` from the Mac (or download the two `.7z` files
   again from https://zenodo.org/records/13960426 into that folder and run
   step 4's unpack line).
3. **Python 3.11 environment**, from the repository root:

   ```
   python -m venv ml\.venv
   ml\.venv\Scripts\activate
   pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
   pip install -r ml\requirements.txt
   python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
   ```

   The last line must print `True` and the GPU's name (e.g. RTX 3050).
4. **Unpack the dataset** (only if you copied the `.7z` files):

   ```
   python -c "import py7zr; [py7zr.SevenZipFile(f'datasets/saliency4asd/{n}.7z').extractall('datasets/saliency4asd') for n in ('TrainingData','AdditionalData')]"
   ```

5. **Train and evaluate** (CUDA is picked automatically):

   ```
   python -m ml.train
   ```

   If the GPU runs out of memory, use a smaller batch: `set AURA_BATCH=4`
   (Windows) before the command. Results go to `ml/results/`; trained
   weights to `ml/checkpoints/` (git-ignored).
