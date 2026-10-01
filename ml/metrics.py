"""
The six standard saliency metrics, as defined by the MIT/Tübingen saliency
benchmark and used by the Saliency4ASD challenge (Bylinskii et al., "What do
different evaluation metrics tell us about saliency models?", TPAMI 2019).

Location-based (against fixation points): AUC-Judd, shuffled AUC, NSS.
Distribution-based (against the blurred fixation density): CC, SIM, KLD.
Higher is better for all but KLD.
"""
import numpy as np

EPS = 2.2204e-16


def _norm01(s: np.ndarray) -> np.ndarray:
    s = s.astype(np.float64)
    return (s - s.min()) / (s.max() - s.min() + EPS)


def _as_dist(s: np.ndarray) -> np.ndarray:
    s = s.astype(np.float64)
    return s / (s.sum() + EPS)


def auc_judd(sal: np.ndarray, fix: np.ndarray, jitter: bool = True) -> float:
    s = _norm01(sal)
    if jitter:  # break ties, as in the reference implementation
        s = s + np.random.default_rng(0).random(s.shape) / 1e7
        s = _norm01(s)
    thresholds = np.sort(s[fix])[::-1]
    n_fix, n_pix = len(thresholds), s.size
    if n_fix == 0:
        return float("nan")
    tp, fp = [0.0], [0.0]
    flat = np.sort(s.ravel())[::-1]
    for k, t in enumerate(thresholds):
        above = np.searchsorted(-flat, -t, side="right")  # pixels >= t
        tp.append((k + 1) / n_fix)
        fp.append((above - (k + 1)) / (n_pix - n_fix))
    tp.append(1.0)
    fp.append(1.0)
    return float(np.trapezoid(tp, fp))


def _roc_auc(pos: np.ndarray, neg: np.ndarray) -> float:
    """P(score of a positive > score of a negative), ties counted half (Mann-Whitney)."""
    if len(pos) == 0 or len(neg) == 0:
        return float("nan")
    allv = np.concatenate([pos, neg])
    order = allv.argsort(kind="mergesort")
    ranks = np.empty(len(allv))
    sorted_v = allv[order]
    # average ranks for ties
    i = 0
    while i < len(allv):
        j = i
        while j + 1 < len(allv) and sorted_v[j + 1] == sorted_v[i]:
            j += 1
        ranks[order[i : j + 1]] = (i + j) / 2 + 1
        i = j + 1
    r_pos = ranks[: len(pos)].sum()
    return float((r_pos - len(pos) * (len(pos) + 1) / 2) / (len(pos) * len(neg)))


def sauc(sal: np.ndarray, fix: np.ndarray, other_fix: np.ndarray) -> float:
    """Shuffled AUC: negatives are fixation locations from OTHER images, so a
    model can't score well just by predicting the centre bias."""
    s = _norm01(sal)
    neg_mask = other_fix & ~fix
    return _roc_auc(s[fix], s[neg_mask])


def nss(sal: np.ndarray, fix: np.ndarray) -> float:
    s = sal.astype(np.float64)
    s = (s - s.mean()) / (s.std() + EPS)
    return float(s[fix].mean()) if fix.any() else float("nan")


def cc(sal: np.ndarray, density: np.ndarray) -> float:
    a = sal.astype(np.float64)
    b = density.astype(np.float64)
    a = (a - a.mean()) / (a.std() + EPS)
    b = (b - b.mean()) / (b.std() + EPS)
    return float((a * b).mean())


def sim(sal: np.ndarray, density: np.ndarray) -> float:
    return float(np.minimum(_as_dist(_norm01(sal)), _as_dist(_norm01(density))).sum())


def kld(sal: np.ndarray, density: np.ndarray) -> float:
    p = _as_dist(sal)
    q = _as_dist(density)
    return float((q * np.log(EPS + q / (p + EPS))).sum())


METRICS = ("AUC-J", "sAUC", "NSS", "CC", "SIM", "KLD")


def all_metrics(sal: np.ndarray, density: np.ndarray, fix: np.ndarray, other_fix: np.ndarray) -> dict[str, float]:
    return {
        "AUC-J": auc_judd(sal, fix),
        "sAUC": sauc(sal, fix, other_fix),
        "NSS": nss(sal, fix),
        "CC": cc(sal, density),
        "SIM": sim(sal, density),
        "KLD": kld(sal, density),
    }
