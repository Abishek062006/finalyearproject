"""
The two analyses that connect the model to AURA's use of it.

1. TARGET ATTENTION (real gaze, no editing). Saliency4ASD ships labelled
   object boxes (face, people, animal, object, car, food…). For each box we
   measure the share of autistic children's real gaze that fell inside it,
   and ask how well each model predicts that share on held-out images
   (Spearman rho, with a paired bootstrap CI for Dual vs TD-only). We also
   measure the real ASD-minus-TD gap per box, check the known face effect,
   and test whether Dual's two heads predict that gap (ASD head - TD head)
   better than two separately trained networks (ASD-only - TD-only).

2. EDITING (model-predicted). For held-out images with a non-human target
   (animal, object, car, food, plant, vehicle), soften everything outside
   the target (blur + desaturate, smallest of 4 strengths that reaches the
   goal) using Dual's ASD prediction, then measure the predicted share of
   autistic attention on the target before and after with an INDEPENDENT
   model: the same fold's ASD-only network, which never saw that image and
   was not used to make the edit. This is still a model's prediction —
   the real test needs children (pilot).
"""
import json

import cv2
import numpy as np
import torch
from scipy.stats import spearmanr, wilcoxon

from ml import data
from ml.model import DualSaliencyNet, SaliencyNet
from ml.train import CKPT, RESULTS, SMOKE, arrays_for_run, device, log

NON_HUMAN = {"object", "animal", "car", "food", "plant", "train", "plane", "ship"}
STRENGTHS = (0.25, 0.5, 0.75, 1.0)


def _boxes_lowres(ids: np.ndarray) -> list[tuple[int, int, int, int, int, str]]:
    """(row index, y1, y2, x1, x2, label) at training resolution."""
    index = {int(i): k for k, i in enumerate(ids)}
    sizes = {}
    out = []
    h, w = data.TRAIN_HW
    for b in data.load_boxes():
        if b.image not in index:
            continue
        if b.image not in sizes:
            sizes[b.image] = data.load_density(b.image, "ASD").shape
        H, W = sizes[b.image]
        y1, y2 = int(b.y1 * h / H), max(int(b.y1 * h / H) + 1, int(np.ceil(b.y2 * h / H)))
        x1, x2 = int(b.x1 * w / W), max(int(b.x1 * w / W) + 1, int(np.ceil(b.x2 * w / W)))
        out.append((index[b.image], max(0, y1), min(h, y2), max(0, x1), min(w, x2), b.label))
    return out


def _share(m: np.ndarray, y1, y2, x1, x2) -> float:
    return float(m[y1:y2, x1:x2].sum() / (m.sum() + 1e-12))


def _boot_rho_diff(a, b, truth, n=2000, seed=0):
    rng = np.random.default_rng(seed)
    a, b, truth = map(np.asarray, (a, b, truth))
    diffs = []
    for _ in range(n):
        s = rng.integers(0, len(a), len(a))
        diffs.append(spearmanr(a[s], truth[s]).statistic - spearmanr(b[s], truth[s]).statistic)
    return float(np.percentile(diffs, 2.5)), float(np.percentile(diffs, 97.5))


def target_attention(preds: dict[str, np.ndarray]) -> dict:
    arrays = arrays_for_run()
    boxes = _boxes_lowres(arrays["ids"])
    real = {g: [_share(arrays[f"{g}_density"][k], y1, y2, x1, x2) for k, y1, y2, x1, x2, _ in boxes] for g in data.GROUPS}
    pred = {key: [_share(preds[key][k], y1, y2, x1, x2) for k, y1, y2, x1, x2, _ in boxes] for key in ("Centre", "TD-only", "ASD-only", "Dual-ASD", "Dual-TD")}
    out = {"n_boxes": len(boxes), "predict_asd_share": {}}
    for key, vals in pred.items():
        rho = spearmanr(vals, real["ASD"]).statistic
        out["predict_asd_share"][key] = {"spearman_rho": float(rho), "mae": float(np.mean(np.abs(np.array(vals) - real["ASD"])))}
    out["dual_vs_tdonly_rho_ci95"] = _boot_rho_diff(pred["Dual-ASD"], pred["TD-only"], real["ASD"])

    gap_real = np.array(real["ASD"]) - np.array(real["TD"])
    gap_dual = np.array(pred["Dual-ASD"]) - np.array(pred["Dual-TD"])
    gap_sep = np.array(pred["ASD-only"]) - np.array(pred["TD-only"])
    out["group_gap"] = {
        "dual_rho": float(spearmanr(gap_dual, gap_real).statistic),
        "separate_rho": float(spearmanr(gap_sep, gap_real).statistic),
        "dual_minus_separate_ci95": _boot_rho_diff(gap_dual, gap_sep, gap_real, seed=1),
    }
    labels = [b[-1] for b in boxes]
    by_label = {}
    for lab in sorted(set(labels)):
        idx = [i for i, l in enumerate(labels) if l == lab]
        if len(idx) < 5:
            continue
        asd = np.array(real["ASD"])[idx]
        td = np.array(real["TD"])[idx]
        p = float(wilcoxon(asd, td).pvalue) if np.any(asd != td) else 1.0
        by_label[lab] = {"n": len(idx), "asd_share": float(asd.mean()), "td_share": float(td.mean()), "p": p}
    out["real_gap_by_label"] = by_label
    return out


def _load(cls, path):
    net = cls(pretrained=False)
    net.load_state_dict(torch.load(path, map_location="cpu"))
    return net.to(device()).eval()


@torch.no_grad()
def _asd_map(net, img: np.ndarray) -> np.ndarray:
    x = torch.from_numpy(img).permute(2, 0, 1)[None].float().div(255).to(device())
    out = net(x)
    logp = out[0] if isinstance(out, tuple) else out
    return logp.exp()[0].float().cpu().numpy()


def edit_image(img: np.ndarray, y1, y2, x1, x2, strength: float) -> np.ndarray:
    """Blur and desaturate everything outside the target box (feathered edge)."""
    h, w = img.shape[:2]
    mask = np.zeros((h, w), np.float32)
    mask[y1:y2, x1:x2] = 1
    mask = cv2.GaussianBlur(mask, (0, 0), 3)
    softened = cv2.GaussianBlur(img, (0, 0), 4).astype(np.float32)
    grey = softened.mean(2, keepdims=True)
    softened = 0.5 * softened + 0.5 * grey
    wgt = (strength * (1 - mask))[..., None]
    return (img.astype(np.float32) * (1 - wgt) + softened * wgt).clip(0, 255).astype(np.uint8)


def editing(preds: dict[str, np.ndarray]) -> dict:
    arrays = arrays_for_run()
    saved = dict(np.load(data.CACHE / ("cv_predictions_smoke.npz" if SMOKE else "cv_predictions.npz")))
    fold_of = saved["fold_of"]
    boxes = [b for b in _boxes_lowres(arrays["ids"]) if b[-1] in NON_HUMAN and (b[2] - b[1]) * (b[4] - b[3]) < 0.5 * data.TRAIN_HW[0] * data.TRAIN_HW[1]]
    rows = []
    models = {}
    for k, y1, y2, x1, x2, label in boxes:
        f = int(fold_of[k])
        if f not in models:
            models[f] = (_load(DualSaliencyNet, CKPT / f"dual_fold{f}.pt"), _load(SaliencyNet, CKPT / f"asdonly_fold{f}.pt"))
        editor, judge = models[f]
        img = arrays["images"][k]
        before_e = _share(_asd_map(editor, img), y1, y2, x1, x2)
        goal = min(0.6, 1.5 * before_e)
        chosen, edited = STRENGTHS[-1], None
        for s in STRENGTHS:
            edited = edit_image(img, y1, y2, x1, x2, s)
            if _share(_asd_map(editor, edited), y1, y2, x1, x2) >= goal:
                chosen = s
                break
        rows.append(
            {
                "label": label,
                "strength": chosen,
                "judge_before": _share(_asd_map(judge, img), y1, y2, x1, x2),
                "judge_after": _share(_asd_map(judge, edited), y1, y2, x1, x2),
                "editor_before": before_e,
            }
        )
    b = np.array([r["judge_before"] for r in rows])
    a = np.array([r["judge_after"] for r in rows])
    gain = a - b
    rng = np.random.default_rng(0)
    boot = rng.choice(gain, size=(5000, len(gain)), replace=True).mean(1) if len(gain) else np.array([0.0])
    return {
        "n_targets": len(rows),
        "judge": "ASD-only network of the same fold (never saw the image; not used to make the edit)",
        "mean_share_before": float(b.mean()) if len(b) else None,
        "mean_share_after": float(a.mean()) if len(a) else None,
        "mean_gain_ci95": [float(np.percentile(boot, 2.5)), float(np.percentile(boot, 97.5))],
        "p_wilcoxon": float(wilcoxon(a, b).pvalue) if len(gain) and np.any(gain != 0) else None,
        "share_improved": float((gain > 0).mean()) if len(gain) else None,
        "strengths_used": {str(s): int(sum(r["strength"] == s for r in rows)) for s in STRENGTHS},
        "rows": rows,
    }


def run(preds: dict[str, np.ndarray]) -> dict:
    log("target-attention study ...")
    ta = target_attention(preds)
    log("editing study ...")
    ed = editing(preds)
    result = {"target_attention": ta, "editing": ed}
    json.dump(result, open(RESULTS / ("analysis_smoke.json" if SMOKE else "analysis.json"), "w", encoding="utf-8"))
    return result
