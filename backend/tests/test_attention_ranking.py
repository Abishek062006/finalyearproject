"""Plan Phase 7: interest photos are ranked by the autism-specific attention
model. The model file is trained on licensed data and is not in git, so the
model-dependent tests skip when it is absent; the fail-safe tests always run."""
import numpy as np
import pytest
from PIL import Image

from app.services import attention_service as att

needs_model = pytest.mark.skipif(not att.MODEL_PATH.exists(), reason="ml/checkpoints/aura_asd_saliency.onnx not present")


def test_clarity_is_one_for_a_single_spike_and_zero_for_a_flat_map():
    spike = np.zeros((24, 32))
    spike[10, 10] = 1
    assert att.clarity(spike) == pytest.approx(1.0, abs=1e-6)
    assert att.clarity(np.ones((24, 32))) == pytest.approx(0.0, abs=1e-6)


def test_without_the_model_or_when_off_candidates_pass_through_untouched(monkeypatch):
    monkeypatch.setenv("AURA_ATTENTION_RANKING", "0")
    cands = [{"image_url": f"https://upload.wikimedia.org/{i}.jpg", "thumb_url": None, "source_title": str(i), "license": "CC"} for i in range(6)]
    assert att.rank(cands, keep=4) == cands[:4]


@needs_model
def test_the_model_returns_a_probability_map_and_a_clarity_in_range(monkeypatch):
    monkeypatch.setenv("AURA_ATTENTION_RANKING", "1")
    img = Image.fromarray(np.random.default_rng(0).integers(0, 255, (300, 400, 3), dtype=np.uint8))
    p = att.attention_map(img)
    assert p.shape == att.INPUT_HW and p.sum() == pytest.approx(1.0, abs=1e-4)
    assert 0.0 <= att.score_image(img) <= 1.0


@needs_model
def test_ranking_orders_by_clarity_flags_the_top_third_and_keeps_unscorable_photos(monkeypatch):
    monkeypatch.setenv("AURA_ATTENTION_RANKING", "1")
    scores = {"a": 0.2, "b": 0.5, "c": 0.35, "d": None, "e": 0.1, "f": 0.45}
    monkeypatch.setattr(att, "_score_url", lambda url: scores[url])
    cands = [{"image_url": k, "thumb_url": k, "source_title": k, "license": "CC"} for k in scores]
    out = att.rank(cands, keep=6)
    assert [c["source_title"] for c in out] == ["b", "f", "c", "a", "e", "d"]  # clearest first, unscored last
    assert [c["attention_clear"] for c in out] == [True, False, False, False, False, False]  # top third of the shown (6//3=2 -> but only 5 scored: 5//3=1)
    assert out[-1]["attention_clarity"] is None
