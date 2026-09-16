"""
Offline content generator (docs/PLAN.md Phase 7): produces the themed prompt
and encouragement text used to render lessons, written ONCE to a JSON bank
committed to the repo. The running app never calls this — zero runtime API
cost, addressing the concern raised early in this project about per-request
generation cost.

Tries a local Ollama instance (http://localhost:11434, free, runs entirely on
your own machine — https://ollama.com) if one happens to be running, and
falls back to a deterministic template otherwise, so this script — and the
seed data it feeds — never depends on anything being installed. Either way,
every generated string passes through `validate_text` before it can be
marked "approved"; anything that fails stays "pending" and is excluded from
what a child ever sees (README §22: "all generated content must be age
appropriate, simple, safe, non-medical").

Run with:  python3 content/generator/generate_theme_content.py
Writes:    content/bank/theme_content.json
"""
from __future__ import annotations  # so `str | None` works on Python < 3.10 too (e.g. this machine's system python3)

import json
import re
import urllib.request
from pathlib import Path

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2"  # small, fast, free — pull with `ollama pull llama3.2`
OLLAMA_TIMEOUT_S = 3

BANK_PATH = Path(__file__).resolve().parent.parent / "bank" / "theme_content.json"

THEMES = [
    {"code": "dino", "label": "Dinosaurs", "guide_name": "Rex", "thing_plural": "dinosaur friends"},
    {"code": "space", "label": "Space", "guide_name": "Astro", "thing_plural": "rockets"},
    {"code": "ocean", "label": "Ocean", "guide_name": "Splash", "thing_plural": "fish friends"},
    {"code": "cars", "label": "Cars", "guide_name": "Turbo", "thing_plural": "race cars"},
]

MAX_WORDS = 8  # short, simple prompts (README §1: "minimal text")
BANNED_WORDS = {"stupid", "dumb", "wrong", "fail", "bad", "hate", "kill", "die", "scary", "afraid"}
# A tiny idiom/figurative-language blocklist — literal language only
# (figurative language is a known, specific difficulty for many autistic
# children; see the project's own earlier research pass on this).
IDIOM_PHRASES = {"piece of cake", "break a leg", "hit the road", "over the moon", "under the weather"}


def validate_text(text: str) -> list[str]:
    """Returns a list of violations; empty means it passes."""
    violations = []
    words = text.strip().split()
    if len(words) == 0:
        violations.append("empty")
    if len(words) > MAX_WORDS:
        violations.append(f"too long ({len(words)} words > {MAX_WORDS})")
    lowered = text.lower()
    if any(w in lowered.split() for w in BANNED_WORDS):
        violations.append("contains a banned word")
    if any(phrase in lowered for phrase in IDIOM_PHRASES):
        violations.append("contains figurative language")
    if not re.match(r"^[A-Za-z0-9 '!?.,]+$", text):
        violations.append("contains unexpected characters")
    return violations


def try_ollama(prompt: str) -> str | None:
    """Best-effort call to a LOCAL Ollama instance. Returns None on any
    failure (not installed, not running, timeout) so the caller always has
    a safe fallback — this script must never hang or crash CI/dev setup
    over a missing local LLM."""
    try:
        body = json.dumps({"model": OLLAMA_MODEL, "prompt": prompt, "stream": False}).encode()
        req = urllib.request.Request(OLLAMA_URL, data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=OLLAMA_TIMEOUT_S) as resp:
            data = json.loads(resp.read())
        return data.get("response", "").strip().strip('"')
    except Exception:
        return None


def counting_prompt_template(thing_plural: str) -> str:
    return f"How many {thing_plural}?"


def encouragement_templates(guide_name: str) -> list[str]:
    return [
        f"Great job! {guide_name} is doing a happy dance!",
        f"{guide_name} says well done!",
        "You did it! Nice work!",
    ]


def generate_theme(theme: dict) -> dict:
    ollama_prompt = (
        f"Write ONE short question (max {MAX_WORDS} words) asking a 4-8 year old "
        f"how many {theme['thing_plural']} are shown in a picture. Simple, literal "
        f"words only, no idioms, no scary or negative words. Reply with only the question."
    )
    generated = try_ollama(ollama_prompt)
    if generated:
        violations = validate_text(generated)
        if not violations:
            counting_prompt, source, status = generated, "ollama", "approved"
        else:
            # Falls back to the template rather than shipping something that
            # failed validation — never guess past a safety check.
            counting_prompt, source, status = counting_prompt_template(theme["thing_plural"]), "template", "approved"
    else:
        counting_prompt, source, status = counting_prompt_template(theme["thing_plural"]), "template", "approved"

    encouragement = encouragement_templates(theme["guide_name"])
    for line in encouragement:
        assert not validate_text(line), f"template encouragement failed its own validation: {line}"

    return {
        "guide_name": theme["guide_name"],
        "counting_prompt": counting_prompt,
        "encouragement": encouragement,
        "source": source,
        "review_status": status,
    }


def main() -> None:
    bank = {"themes": {}}
    for theme in THEMES:
        bank["themes"][theme["code"]] = generate_theme(theme)

    BANK_PATH.parent.mkdir(parents=True, exist_ok=True)
    BANK_PATH.write_text(json.dumps(bank, indent=2) + "\n")

    sources = {code: t["source"] for code, t in bank["themes"].items()}
    print(f"Wrote {BANK_PATH}")
    print(f"Sources: {sources}")
    if all(s == "template" for s in sources.values()):
        print("(No local Ollama instance found — used the deterministic template for every theme, which is fine.)")


if __name__ == "__main__":
    main()
