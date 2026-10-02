"""
Scores every model's held-out predictions at the original image resolution
against BOTH groups' real gaze (the six standard metrics), then tests the
differences that matter with paired statistics:

- Wilcoxon signed-rank tests on per-image scores (each image is its own
  pair), Holm-corrected within each metric's family of comparisons;
- the mean per-image difference with a 95% bootstrap confidence interval.

Main comparison: Dual (ours, ASD head) vs every other model, on autistic
children's gaze. Also reported: whether Dual's TD head loses anything on
typical children's gaze, and the cross-group pattern (does each model
predict its own group best?).
"""
import json

import cv2
import numpy as np
from scipy.stats import wilcoxon

from ml import data
from ml.metrics import METRICS, all_metrics
from ml.train import RESULTS, SMOKE, arrays_for_run, log

# (prediction key, label) per row of the results tables
ROWS = [("Centre", "Centre bias"), ("SpecRes", "Spectral residual"), ("TD-only", "TD-only"), ("ASD-only", "ASD-only"), ("Dual-TD", "Dual: TD head"), ("Dual-ASD", "Dual: ASD head (ours)")]
HIGHER_BETTER = {m: m != "KLD" for m in METRICS}


def _points(ids, group):
    pts = {}
    for i in ids:
        f = data.load_fixations(int(i), group)
        ys, xs = np.nonzero(f)
        pts[int(i)] = np.stack([ys / f.shape[0], xs / f.shape[1]], 1)
    return pts


def score_all(preds: dict[str, np.ndarray]) -> dict:
    ids = arrays_for_run()["ids"]
    per = {}
    for g in data.GROUPS:
        pts = _points(ids, g)
        truth = {int(i): (data.load_density(int(i), g), data.load_fixations(int(i), g)) for i in ids}
        for key, _label in ROWS:
            rows = []
            for k, i in enumerate(ids):
                density, fix = truth[int(i)]
                h, w = density.shape
                sal = cv2.resize(preds[key][k].astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR)
                others = np.concatenate([p for j, p in pts.items() if j != int(i)])
                other_fix = np.zeros((h, w), bool)
                other_fix[(others[:, 0] * h).astype(int).clip(0, h - 1), (others[:, 1] * w).astype(int).clip(0, w - 1)] = True
                rows.append(all_metrics(sal, density, fix, other_fix))
            per[f"{key}|{g}"] = rows
            log(f"  scored {key} vs {g}")
    return per


def _holm(ps: list[float]) -> list[float]:
    order = np.argsort(ps)
    adj, running = [0.0] * len(ps), 0.0
    for rank, i in enumerate(order):
        running = max(running, min(1.0, ps[i] * (len(ps) - rank)))
        adj[i] = running
    return adj


def _bootstrap_ci(diffs: np.ndarray, n: int = 5000, seed: int = 0) -> tuple[float, float]:
    rng = np.random.default_rng(seed)
    means = rng.choice(diffs, size=(n, len(diffs)), replace=True).mean(1)
    return float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))


def compare(per: dict, ours: str, others: list[str], group: str) -> list[dict]:
    """Paired tests of `ours` vs each of `others`, per metric, Holm-corrected per metric."""
    out = []
    for m in METRICS:
        tests = []
        for o in others:
            a = np.array([r[m] for r in per[f"{ours}|{group}"]])
            b = np.array([r[m] for r in per[f"{o}|{group}"]])
            ok = ~(np.isnan(a) | np.isnan(b))
            d = a[ok] - b[ok]
            p = float(wilcoxon(a[ok], b[ok]).pvalue) if np.any(d != 0) else 1.0
            lo, hi = _bootstrap_ci(d)
            better = (d.mean() > 0) == HIGHER_BETTER[m]
            tests.append({"metric": m, "vs": o, "mean_diff": float(d.mean()), "ci95": [lo, hi], "p": p, "ours_better": bool(better), "n": int(ok.sum())})
        for t, adj in zip(tests, _holm([t["p"] for t in tests])):
            t["p_holm"] = adj
            t["significant"] = bool(adj < 0.05)
        out += tests
    return out


def summarise(per: dict) -> dict:
    return {key: {m: float(np.nanmean([r[m] for r in rows])) for m in METRICS} for key, rows in per.items()}


def run(preds: dict[str, np.ndarray]) -> dict:
    log("evaluating every model against both groups' real gaze ...")
    per = score_all(preds)
    result = {
        "summary": summarise(per),
        "asd_tests": compare(per, "Dual-ASD", ["Centre", "SpecRes", "TD-only", "ASD-only"], "ASD"),
        "td_tests": compare(per, "Dual-TD", ["TD-only"], "TD"),
        "per_image": per,
    }
    name = "eval_smoke.json" if SMOKE else "eval.json"
    json.dump(result, open(RESULTS / name, "w", encoding="utf-8"))
    return result
