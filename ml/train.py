"""
5-fold cross-validated training and evaluation of autism-specific attention
prediction on Saliency4ASD.

Per fold (240 training images, 60 test images never seen in training):
  TD        ImageNet init → trained on typically developing children's gaze
  ASD       ImageNet init → trained on autistic children's gaze
  TD→ASD    the TD model, fine-tuned on autistic children's gaze  (ours)
Baselines, scored on the same splits:
  Centre    the average fixation map of the training images (a strong
            "look at the middle" prior)
  SpecRes   spectral residual saliency (Hou & Zhang, CVPR 2007), a classic
            bottom-up model with no learning

Every model is scored at the original image resolution against BOTH groups'
real fixations, with the six standard metrics (metrics.py).

    ml/.venv/bin/python -m ml.train            (from the repo root)

Writes ml/results/saliency_results.{json,md}; held-out predictions go to
ml/cache/ for the target-attention study (target_attention.py).
"""
import json
import os
import time
from pathlib import Path

import cv2
import numpy as np
import torch

from ml import data
from ml.metrics import METRICS, all_metrics
from ml.model import SaliencyNet, saliency_loss

RESULTS = Path(__file__).resolve().parent / "results"
CKPT = Path(__file__).resolve().parent / "checkpoints"
SEED = 0
EPOCHS = {"TD": 20, "ASD": 20, "TD→ASD": 12}
BATCH = int(os.environ.get("AURA_BATCH", "8"))  # lower it if the GPU runs out of memory


def device() -> torch.device:
    """NVIDIA GPU (CUDA) first, then Apple GPU (MPS), then CPU."""
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("mps" if torch.backends.mps.is_available() else "cpu")


def _batches(idx: np.ndarray, rng: np.random.Generator):
    idx = rng.permutation(idx)
    for k in range(0, len(idx), BATCH):
        yield idx[k : k + BATCH]


def train_model(arrays, train_idx, group: str, epochs: int, init: SaliencyNet | None, seed: int, log) -> SaliencyNet:
    torch.manual_seed(seed)
    dev = device()
    net = init if init is not None else SaliencyNet()
    net.to(dev).train()
    enc = [p for n, p in net.named_parameters() if n.split(".")[0] in ("stem", "l2", "l3", "l4")]
    dec = [p for n, p in net.named_parameters() if n.split(".")[0] not in ("stem", "l2", "l3", "l4")]
    lr_scale = 0.5 if init is not None else 1.0  # gentler when fine-tuning
    opt = torch.optim.Adam([{"params": enc, "lr": 1e-4 * lr_scale}, {"params": dec, "lr": 1e-3 * lr_scale}])
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs)
    rng = np.random.default_rng(seed)
    images = torch.from_numpy(arrays["images"]).permute(0, 3, 1, 2).float() / 255.0
    dens = torch.from_numpy(arrays[f"{group}_density"])
    fixs = torch.from_numpy(arrays[f"{group}_fix"])
    for ep in range(epochs):
        total, n = 0.0, 0
        for b in _batches(train_idx, rng):
            x, d, f = images[b], dens[b], fixs[b]
            if rng.random() < 0.5:  # horizontal flip
                x, d, f = x.flip(-1), d.flip(-1), f.flip(-1)
            x, d, f = x.to(dev), d.to(dev), f.to(dev)
            loss = saliency_loss(net(x), d, f)
            opt.zero_grad()
            loss.backward()
            opt.step()
            total += loss.item() * len(b)
            n += len(b)
        sched.step()
        log(f"    {group} epoch {ep + 1}/{epochs} loss {total / n:.4f}")
    return net.eval()


@torch.no_grad()
def predict(net: SaliencyNet, arrays, idx: np.ndarray) -> np.ndarray:
    dev = device()
    out = []
    for k in range(0, len(idx), 16):
        x = torch.from_numpy(arrays["images"][idx[k : k + 16]]).permute(0, 3, 1, 2).float().to(dev) / 255.0
        out.append(net(x).exp().cpu().numpy())
    return np.concatenate(out)


def spectral_residual(img: np.ndarray) -> np.ndarray:
    """Hou & Zhang (2007): saliency = what's left of the log spectrum after
    removing its smooth average."""
    g = cv2.resize(cv2.cvtColor(img, cv2.COLOR_RGB2GRAY), (64, 64)).astype(np.float64)
    f = np.fft.fft2(g)
    log_amp = np.log(np.abs(f) + 1e-8)
    phase = np.angle(f)
    residual = log_amp - cv2.blur(log_amp, (3, 3))
    sal = np.abs(np.fft.ifft2(np.exp(residual + 1j * phase))) ** 2
    sal = cv2.GaussianBlur(sal, (9, 9), 2.5)
    return cv2.resize(sal.astype(np.float32), data.TRAIN_HW[::-1])


def _norm_points(ids, group):
    """Each image's fixations as (y/H, x/W) — reused as sAUC negatives for other images."""
    pts = {}
    for i in ids:
        f = data.load_fixations(int(i), group)
        ys, xs = np.nonzero(f)
        pts[int(i)] = np.stack([ys / f.shape[0], xs / f.shape[1]], 1)
    return pts


def evaluate(pred_lowres: np.ndarray, image_id: int, group: str, others: np.ndarray) -> dict:
    density = data.load_density(image_id, group)
    fix = data.load_fixations(image_id, group)
    h, w = density.shape
    sal = cv2.resize(pred_lowres.astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR)
    other_fix = np.zeros((h, w), bool)
    other_fix[(others[:, 0] * h).astype(int).clip(0, h - 1), (others[:, 1] * w).astype(int).clip(0, w - 1)] = True
    return all_metrics(sal, density, fix, other_fix)


def main() -> None:
    t0 = time.time()
    RESULTS.mkdir(exist_ok=True)
    CKPT.mkdir(exist_ok=True)
    log_file = open(RESULTS / "train_log.txt", "w")

    def log(msg: str) -> None:
        line = f"[{time.time() - t0:7.0f}s] {msg}"
        print(line, flush=True)
        log_file.write(line + "\n")
        log_file.flush()

    arrays = data.training_arrays()
    ids = arrays["ids"]
    n = len(ids)
    fold_idx = data.folds(n, 5, SEED)
    points = {g: _norm_points(ids, g) for g in data.GROUPS}
    models = ["Centre", "SpecRes", "TD", "ASD", "TD→ASD"]
    preds = {m: np.zeros((n, *data.TRAIN_HW), np.float32) for m in models}
    log(f"device={device()}  images={n}  folds={[len(f) for f in fold_idx]}")

    for f, test in enumerate(fold_idx):
        train = np.setdiff1d(np.arange(n), test)
        log(f"fold {f + 1}/5: train {len(train)}, test {len(test)}")
        centre = arrays["ASD_density"][train].mean(0) + arrays["TD_density"][train].mean(0)
        for k in test:
            preds["Centre"][k] = centre
            preds["SpecRes"][k] = spectral_residual(arrays["images"][k])
        td = train_model(arrays, train, "TD", EPOCHS["TD"], None, SEED + f, log)
        preds["TD"][test] = predict(td, arrays, test)
        torch.save(td.state_dict(), CKPT / f"td_fold{f}.pt")
        asd = train_model(arrays, train, "ASD", EPOCHS["ASD"], None, SEED + 100 + f, log)
        preds["ASD"][test] = predict(asd, arrays, test)
        tuned = train_model(arrays, train, "ASD", EPOCHS["TD→ASD"], td, SEED + 200 + f, log)
        preds["TD→ASD"][test] = predict(tuned, arrays, test)
        torch.save(tuned.state_dict(), CKPT / f"td2asd_fold{f}.pt")
        np.savez_compressed(data.CACHE / "heldout_predictions.npz", ids=ids, folds=np.array([np.isin(np.arange(n), t) * (i + 1) for i, t in enumerate(fold_idx)]).sum(0), **{m.replace("→", "2"): p for m, p in preds.items()})

    log("evaluating at original resolution against both groups' real gaze …")
    per_image = {}
    for m in models:
        for g in data.GROUPS:
            rows = []
            for k, i in enumerate(ids):
                others = np.concatenate([p for j, p in points[g].items() if j != int(i)])
                rows.append(evaluate(preds[m][k], int(i), g, others))
            per_image[f"{m}|{g}"] = rows
            means = {mt: float(np.nanmean([r[mt] for r in rows])) for mt in METRICS}
            log(f"  {m:8s} vs {g}: " + "  ".join(f"{k} {v:.3f}" for k, v in means.items()))

    summary = {
        key: {mt: {"mean": float(np.nanmean([r[mt] for r in rows])), "sd": float(np.nanstd([r[mt] for r in rows]))} for mt in METRICS}
        for key, rows in per_image.items()
    }
    json.dump({"summary": summary, "per_image": per_image, "image_ids": [int(i) for i in ids], "epochs": EPOCHS, "seed": SEED}, open(RESULTS / "saliency_results.json", "w"))

    lines = [
        "# Autism-specific attention prediction — Saliency4ASD, 5-fold cross-validation",
        "",
        "Every number is on images the model never saw in training (60 per fold, all 300 covered). ↑ higher is better, ↓ lower is better.",
        "",
    ]
    for g in data.GROUPS:
        lines += [f"## Predicting {'autistic (ASD)' if g == 'ASD' else 'typically developing (TD)'} children's gaze", "", "| Model | " + " | ".join(f"{m} {'↓' if m == 'KLD' else '↑'}" for m in METRICS) + " |", "|---|" + "---|" * len(METRICS)]
        for m in models:
            s = summary[f"{m}|{g}"]
            lines.append(f"| {m} | " + " | ".join(f"{s[mt]['mean']:.3f}" for mt in METRICS) + " |")
        lines.append("")
    (RESULTS / "saliency_results.md").write_text("\n".join(lines))
    log("done")


if __name__ == "__main__":
    main()
