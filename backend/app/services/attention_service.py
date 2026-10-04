"""
Picture quality check for a child's interest photos (plan Phase 7,
"Designing for Autistic Eyes").

When a parent searches for their child's favourite thing, the search
fetches a few more candidate photos than it shows, scores each one with
the autism-specific attention model (ml/, trained on the Saliency4ASD
eye-tracking data), and shows the clearest ones first.

What the score is: how CONCENTRATED the model predicts an autistic child's
gaze will be on the picture. A photo with one clear subject draws attention
to one place (high clarity); a cluttered scene scatters it (low clarity).
    clarity = 1 - entropy(predicted attention map) / maximum entropy

What it is not: it is not validated against children's eyes (the model is
validated on held-out eye-tracking data only; see docs/IEEE_REPORT.md), it
does not know WHICH object is the interest, and it predicts the average
autistic child, not this child. It is a gentle ordering aid — which is why
the app only labels the top of the list "Clear picture" and never hides or
rejects a photo.

No camera or child data is involved: the model sees only the picture.
Everything here fails safe: if the model file, onnxruntime or the network is
unavailable, candidates come back exactly as they were.
"""
import io
import logging
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image

log = logging.getLogger(__name__)

MODEL_PATH = Path(os.environ.get("AURA_ATTENTION_MODEL") or Path(__file__).resolve().parents[3] / "ml" / "checkpoints" / "aura_asd_saliency.onnx")
INPUT_HW = (240, 320)  # what the model was trained at
FETCH_TIMEOUT_S = 8
MAX_BYTES = 8_000_000
WORKERS = 4
POOL_SIZE = 8  # candidates to score; the best few are shown


def enabled() -> bool:
    """Off with AURA_ATTENTION_RANKING=0 (the test suite does this)."""
    return os.environ.get("AURA_ATTENTION_RANKING", "1") != "0"


@lru_cache(maxsize=1)
def _session():
    if not MODEL_PATH.exists():
        return None
    try:
        import onnxruntime as ort

        return ort.InferenceSession(str(MODEL_PATH), providers=["CPUExecutionProvider"])
    except Exception:  # pragma: no cover — library missing or file unreadable
        log.warning("attention model could not be loaded; photo ranking is off", exc_info=True)
        return None


def available() -> bool:
    return enabled() and _session() is not None


def attention_map(image: Image.Image) -> np.ndarray:
    """Predicted autistic-attention map (H, W) summing to 1, for any PIL image."""
    h, w = INPUT_HW
    arr = np.asarray(image.convert("RGB").resize((w, h), Image.LANCZOS), dtype=np.float32) / 255.0
    out = _session().run(None, {"image": arr.transpose(2, 0, 1)[None]})[0][0]
    return out / (out.sum() + 1e-12)


def clarity(p: np.ndarray) -> float:
    """1 = all attention on one spot, 0 = spread evenly over the picture."""
    q = p.ravel().astype(np.float64)
    q = q / (q.sum() + 1e-12)
    entropy = -(q * np.log(q + 1e-12)).sum()
    return float(1.0 - entropy / np.log(q.size))


def score_image(image: Image.Image) -> float:
    return clarity(attention_map(image))


def _fetch(url: str) -> Image.Image | None:
    from app.services.companion_service import USER_AGENT, validate_image_url

    try:
        validate_image_url(url)  # same allow-list as everything else that downloads
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=FETCH_TIMEOUT_S) as resp:
            raw = resp.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            return None
        return Image.open(io.BytesIO(raw))
    except Exception:
        return None


def _score_url(url: str) -> float | None:
    img = _fetch(url)
    if img is None:
        return None
    try:
        return score_image(img)
    except Exception:
        log.warning("could not score a candidate", exc_info=True)
        return None


def rank(candidates: list[dict], keep: int) -> list[dict]:
    """Scores the candidates and returns the best `keep`, clearest first.
    Adds `attention_clarity` (0-1, or None if it couldn't be scored) and
    `attention_clear` (True for the top third of the photos shown, at least one). Candidates that
    couldn't be scored stay in, after the scored ones, in their original order."""
    if not available() or not candidates:
        return candidates[:keep]
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        scores = list(pool.map(lambda c: _score_url(c.get("thumb_url") or c["image_url"]), candidates))
    scored = [(c, s) for c, s in zip(candidates, scores) if s is not None]
    unscored = [c for c, s in zip(candidates, scores) if s is None]
    if not scored:
        return candidates[:keep]
    scored.sort(key=lambda cs: cs[1], reverse=True)
    n_clear = max(1, min(len(scored), keep) // 3)  # of what is SHOWN: the top third, at least one
    out = []
    for i, (c, s) in enumerate(scored):
        out.append({**c, "attention_clarity": round(s, 4), "attention_clear": i < n_clear})
    out += [{**c, "attention_clarity": None, "attention_clear": False} for c in unscored]
    return out[:keep]
