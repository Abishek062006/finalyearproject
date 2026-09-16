"""
Proves the safety/quality gate in generate_theme_content.py actually rejects
content, not just that it exists (README §22: age-appropriate, simple, safe).
Run with: backend/.venv/bin/python -m pytest content/generator/ -v
"""
from generate_theme_content import MAX_WORDS, THEMES, generate_theme, validate_text


def test_a_reasonable_prompt_passes():
    assert validate_text("How many dinosaur friends?") == []


def test_too_long_is_rejected():
    long_text = " ".join(["word"] * (MAX_WORDS + 5))
    assert "too long" in validate_text(long_text)[0]


def test_banned_words_are_rejected():
    assert any("banned word" in v for v in validate_text("You got that wrong, dumb try"))


def test_idioms_are_rejected():
    assert any("figurative" in v for v in validate_text("This is a piece of cake!"))


def test_unexpected_characters_are_rejected():
    assert any("unexpected characters" in v for v in validate_text("How many dinos?! <script>"))


def test_every_seeded_theme_generates_bank_content_that_passes_validation():
    for theme in THEMES:
        entry = generate_theme(theme)
        assert entry["review_status"] == "approved"
        assert validate_text(entry["counting_prompt"]) == []
        for line in entry["encouragement"]:
            assert validate_text(line) == []
