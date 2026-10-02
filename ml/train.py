"""
5-fold cross-validated training on Saliency4ASD (300 images; each fold
trains on 240 and tests on 60 images it never saw).

Models compared on the same splits:
  Centre      average fixation map of the training images (strong prior)
  SpecRes     spectral residual saliency (Hou & Zhang, CVPR 2007)
  TD-only     one network trained on typically developing children's gaze
  ASD-only    one network trained on autistic children's gaze
  Dual        OURS (model.DualSaliencyNet): typical attention + an explicit
              difference head, trained on both groups' gaze at once

Robust for long unattended runs: resumes from the last finished fold,
uses mixed precision on NVIDIA GPUs, halves the batch if the GPU runs out
of memory, and prints ASCII only (Windows consoles).

Settings via environment variables: AURA_BATCH (default 8), AURA_SMOKE=1
(a few-minute end-to-end check on 24 images, 2 folds, 1 epoch).
"""
import json
import os
import time
from pathlib import Path

import cv2
import numpy as np
import torch

from ml import data
from ml.model import ENCODER_PREFIXES, DualSaliencyNet, SaliencyNet, saliency_loss

HERE = Path(__file__).resolve().parent
RESULTS = HERE / "results"
CKPT = HERE / "checkpoints"
SMOKE = os.environ.get("AURA_SMOKE") == "1"
SEED = 0
N_FOLDS = 2 if SMOKE else 5
EPOCHS = {"single": 1, "dual": 1} if SMOKE else {"single": 20, "dual": 24}
DIFF_PENALTY = 1e-3  # keeps the difference head to what is really different
MODELS = ["Centre", "SpecRes", "TD-only", "ASD-only", "Dual"]

_t0 = time.time()
_logf = None


def log(msg: str) -> None:
    global _logf
    if _logf is None:
        RESULTS.mkdir(exist_ok=True)
        _logf = open(RESULTS / ("smoke_log.txt" if SMOKE else "train_log.txt"), "a", encoding="utf-8")
    line = f"[{time.time() - _t0:7.0f}s] {msg}"
    print(line.encode("ascii", "replace").decode(), flush=True)
    _logf.write(line + "\n")
    _logf.flush()


def device() -> torch.device:
    """NVIDIA GPU (CUDA) first, then Apple GPU (MPS), then CPU."""
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("mps" if torch.backends.mps.is_available() else "cpu")


def arrays_for_run() -> dict:
    a = data.training_arrays()
    if SMOKE:
        a = {k: v[:24] for k, v in a.items()}
    return a


def _param_groups(net, lr: float):
    enc = [p for n, p in net.named_parameters() if n.startswith(ENCODER_PREFIXES)]
    dec = [p for n, p in net.named_parameters() if not n.startswith(ENCODER_PREFIXES)]
    return [{"params": enc, "lr": lr}, {"params": dec, "lr": lr * 10}]


def _fit(net, arrays, idx: np.ndarray, epochs: int, seed: int, step_loss, name: str):
    """Shared training loop. step_loss(net, x, batch_indices, flipped) -> loss."""
    torch.manual_seed(seed)
    dev = device()
    net.to(dev).train()
    opt = torch.optim.Adam(_param_groups(net, 1e-4))
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs)
    use_amp = dev.type == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)
    images = torch.from_numpy(arrays["images"]).permute(0, 3, 1, 2)
    rng = np.random.default_rng(seed)
    batch = int(os.environ.get("AURA_BATCH", "8"))
    ep = 0
    while ep < epochs:
        try:
            order = rng.permutation(idx)
            total = 0.0
            for k in range(0, len(order), batch):
                b = order[k : k + batch]
                flip = bool(rng.random() < 0.5)
                x = images[b].float().div(255)
                if flip:
                    x = x.flip(-1)
                x = x.to(dev)
                with torch.autocast(device_type="cuda", dtype=torch.float16, enabled=use_amp):
                    loss = step_loss(net, x, b, flip)
                opt.zero_grad(set_to_none=True)
                scaler.scale(loss).backward()
                scaler.step(opt)
                scaler.update()
                total += float(loss) * len(b)
            sched.step()
            ep += 1
            log(f"    {name} epoch {ep}/{epochs} loss {total / len(order):.4f}")
        except torch.cuda.OutOfMemoryError:
            if batch == 1:
                raise
            torch.cuda.empty_cache()
            batch = max(1, batch // 2)
            log(f"    GPU out of memory - retrying epoch {ep + 1} with batch {batch}")
    return net.eval()


def _targets(arrays, group: str, b: np.ndarray, flip: bool, dev):
    d = torch.from_numpy(arrays[f"{group}_density"][b])
    f = torch.from_numpy(arrays[f"{group}_fix"][b])
    if flip:
        d, f = d.flip(-1), f.flip(-1)
    return d.to(dev), f.to(dev)


def train_single(arrays, idx, group: str, seed: int) -> SaliencyNet:
    dev = device()

    def step(net, x, b, flip):
        d, f = _targets(arrays, group, b, flip, dev)
        return saliency_loss(net(x), d, f)

    return _fit(SaliencyNet(), arrays, idx, EPOCHS["single"], seed, step, f"{group}-only")


def train_dual(arrays, idx, seed: int) -> DualSaliencyNet:
    dev = device()

    def step(net, x, b, flip):
        asd_logp, td_logp, diff = net(x, with_diff=True)
        da, fa = _targets(arrays, "ASD", b, flip, dev)
        dt, ft = _targets(arrays, "TD", b, flip, dev)
        return saliency_loss(asd_logp, da, fa) + saliency_loss(td_logp, dt, ft) + DIFF_PENALTY * diff.float().abs().mean()

    return _fit(DualSaliencyNet(), arrays, idx, EPOCHS["dual"], seed, step, "Dual")


@torch.no_grad()
def predict(net, arrays, idx: np.ndarray) -> dict[str, np.ndarray]:
    """Probability maps, averaged with the horizontally flipped image (test-time augmentation)."""
    dev = device()
    out: dict[str, list] = {}
    for k in range(0, len(idx), 8):
        x = torch.from_numpy(arrays["images"][idx[k : k + 8]]).permute(0, 3, 1, 2).float().div(255).to(dev)
        if isinstance(net, DualSaliencyNet):
            a1, t1, d1 = net(x, with_diff=True)
            a2, t2, d2 = net(x.flip(-1), with_diff=True)
            parts = {"ASD": (a1.exp() + a2.exp().flip(-1)) / 2, "TD": (t1.exp() + t2.exp().flip(-1)) / 2, "DIFF": (d1 + d2.flip(-1)) / 2}
        else:
            parts = {"map": (net(x).exp() + net(x.flip(-1)).exp().flip(-1)) / 2}
        for key, v in parts.items():
            out.setdefault(key, []).append(v.float().cpu().numpy())
    return {k: np.concatenate(v) for k, v in out.items()}


def spectral_residual(img: np.ndarray) -> np.ndarray:
    g = cv2.resize(cv2.cvtColor(img, cv2.COLOR_RGB2GRAY), (64, 64)).astype(np.float64)
    f = np.fft.fft2(g)
    residual = np.log(np.abs(f) + 1e-8) - cv2.blur(np.log(np.abs(f) + 1e-8), (3, 3))
    sal = np.abs(np.fft.ifft2(np.exp(residual + 1j * np.angle(f)))) ** 2
    return cv2.resize(cv2.GaussianBlur(sal, (9, 9), 2.5).astype(np.float32), data.TRAIN_HW[::-1])


PRED_KEYS = ["Centre", "SpecRes", "TD-only", "ASD-only", "Dual-ASD", "Dual-TD", "Dual-DIFF"]


def preds_path() -> Path:
    return data.CACHE / ("cv_predictions_smoke.npz" if SMOKE else "cv_predictions.npz")


def run_cross_validation() -> dict[str, np.ndarray]:
    """Trains every fold (skipping folds already finished) and returns held-out predictions."""
    arrays = arrays_for_run()
    n = len(arrays["ids"])
    fold_idx = data.folds(n, N_FOLDS, SEED)
    CKPT.mkdir(exist_ok=True)
    path = preds_path()
    if path.exists():
        saved = dict(np.load(path))
        preds = {k: saved[k] for k in PRED_KEYS}
        done = set(saved["done_folds"].tolist())
    else:
        preds = {k: np.zeros((n, *data.TRAIN_HW), np.float32) for k in PRED_KEYS}
        done = set()
    log(f"device={device()} images={n} folds={N_FOLDS} done={sorted(done)} smoke={SMOKE}")

    for f, test in enumerate(fold_idx):
        if f in done:
            continue
        train = np.setdiff1d(np.arange(n), test)
        log(f"fold {f + 1}/{N_FOLDS}: train {len(train)}, test {len(test)}")
        centre = arrays["ASD_density"][train].mean(0) + arrays["TD_density"][train].mean(0)
        for k in test:
            preds["Centre"][k] = centre
            preds["SpecRes"][k] = spectral_residual(arrays["images"][k])
        td = train_single(arrays, train, "TD", SEED + f)
        preds["TD-only"][test] = predict(td, arrays, test)["map"]
        torch.save(td.state_dict(), CKPT / f"tdonly_fold{f}.pt")
        asd = train_single(arrays, train, "ASD", SEED + 100 + f)
        preds["ASD-only"][test] = predict(asd, arrays, test)["map"]
        torch.save(asd.state_dict(), CKPT / f"asdonly_fold{f}.pt")
        dual = train_dual(arrays, train, SEED + 200 + f)
        p = predict(dual, arrays, test)
        preds["Dual-ASD"][test], preds["Dual-TD"][test], preds["Dual-DIFF"][test] = p["ASD"], p["TD"], p["DIFF"]
        torch.save(dual.state_dict(), CKPT / f"dual_fold{f}.pt")
        done.add(f)
        fold_of = np.zeros(n, int)
        for i, t in enumerate(fold_idx):
            fold_of[t] = i
        np.savez_compressed(path, ids=arrays["ids"], fold_of=fold_of, done_folds=np.array(sorted(done)), **preds)
        log(f"fold {f + 1} saved")
        del td, asd, dual
        if device().type == "cuda":
            torch.cuda.empty_cache()
    return preds


def train_final_model() -> Path:
    """The deployable model: Dual trained on all images (no held-out set)."""
    out = CKPT / ("dual_final_smoke.pt" if SMOKE else "dual_final.pt")
    if out.exists():
        return out
    arrays = arrays_for_run()
    log("final model: Dual on all images")
    net = train_dual(arrays, np.arange(len(arrays["ids"])), SEED + 999)
    torch.save(net.state_dict(), out)
    return out


if __name__ == "__main__":
    run_cross_validation()
    train_final_model()
