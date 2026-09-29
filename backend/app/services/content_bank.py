"""
Reads the offline-generated content bank (content/generator/generate_theme_content.py,
docs/PLAN.md Phase 7) at request time — the file itself was produced ahead of
time with zero runtime API cost; this module just loads the already-written
JSON, cached in memory after the first read.
"""
import json
from functools import lru_cache
from pathlib import Path

# backend/app/services/content_bank.py -> parents[3] is the repo root
BANK_PATH = Path(__file__).resolve().parents[3] / "content" / "bank" / "theme_content.json"

FALLBACK = {
    "guide_name": "Friend",
    "counting_prompt": "How many?",
    "identify_prompt_template": "Find the letter {label}!",
    "match_prompt": "Match them all!",
    "sequence_prompt": "Put them in order!",
    "encouragement": ["Great job!"],
}


@lru_cache(maxsize=1)
def _load_bank() -> dict:
    if not BANK_PATH.exists():
        return {"themes": {}}
    return json.loads(BANK_PATH.read_text())


def get_theme_content(theme_code: str) -> dict:
    """Only ever returns approved content — a 'pending' entry (failed
    validation) falls back rather than ever reaching a child (README §22)."""
    entry = _load_bank().get("themes", {}).get(theme_code)
    if entry is None or entry.get("review_status") != "approved":
        return FALLBACK
    return entry
