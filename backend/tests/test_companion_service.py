"""
docs/PLAN.md UX-overhaul Phase C: a parent-chosen companion, sourced from a
live Wikimedia Commons search — the network call itself is verified manually
(same discipline as content/generator/generate_theme_content.py's Ollama
call: best-effort external service, tested via its deterministic/validated
path, not by hitting the real network on every test run). These tests
monkeypatch the one function that hits the network (`_download_and_square`)
and otherwise exercise the real validation/persistence logic.
"""
import pytest

from app.models.identity import Child
from app.services import companion_service


def test_validate_query_accepts_a_reasonable_word():
    assert companion_service.validate_query("trains") == []


def test_validate_query_rejects_empty():
    assert "empty" in companion_service.validate_query("   ")


def test_validate_query_rejects_too_many_words():
    violations = companion_service.validate_query("one two three four five six")
    assert any("too many words" in v for v in violations)


def test_validate_query_rejects_too_long():
    violations = companion_service.validate_query("a" * 41)
    assert any("too long" in v for v in violations)


def test_validate_query_rejects_banned_words():
    assert any("banned word" in v for v in companion_service.validate_query("scary monster"))


def test_validate_query_rejects_unexpected_characters():
    assert any("unexpected characters" in v for v in companion_service.validate_query("trains<script>"))


def test_set_child_companion_updates_the_child_and_resolves_a_url(seeded_db, child_id, monkeypatch, tmp_path):
    # MEDIA_DIR patched too, not just _download_and_square — the real path is
    # computed from the module-level MEDIA_DIR inside set_child_companion, so
    # leaving it unpatched would still write a real file under backend/media/.
    monkeypatch.setattr(companion_service, "MEDIA_DIR", tmp_path / "companions")
    monkeypatch.setattr(companion_service, "_download_and_square", lambda url, dest, size=480: dest.parent.mkdir(parents=True, exist_ok=True) or dest.write_bytes(b"fake"))

    child = companion_service.set_child_companion(
        seeded_db, child_id, query="unicorns", image_url="https://example.org/fake.jpg", source_title="Fake unicorn.jpg"
    )

    assert child.companion_name == "Unicorns"
    assert child.companion_image_path == f"companions/{child_id}.jpg"
    assert child.companion_image_url == f"/media/companions/{child_id}.jpg"
    assert child.companion_source_title == "Fake unicorn.jpg"


def test_set_child_companion_rejects_an_invalid_query(seeded_db, child_id, monkeypatch):
    called = False

    def fail_if_called(*args, **kwargs):
        nonlocal called
        called = True

    monkeypatch.setattr(companion_service, "_download_and_square", fail_if_called)

    with pytest.raises(ValueError):
        companion_service.set_child_companion(seeded_db, child_id, query="", image_url="https://example.org/x.jpg", source_title="x")

    assert not called, "must validate before ever touching the network"


def test_delete_companion_file_removes_the_stored_image(tmp_path, monkeypatch):
    monkeypatch.setattr(companion_service, "MEDIA_DIR", tmp_path / "companions")
    stored = tmp_path / "companions" / "child123.jpg"
    stored.parent.mkdir(parents=True)
    stored.write_bytes(b"fake")

    child = Child(nickname="Rae", birth_year_month="2020-03", created_by="u1")
    child.companion_image_path = "companions/child123.jpg"

    companion_service.delete_companion_file(child)
    assert not stored.exists()


def test_delete_companion_file_is_a_noop_without_a_companion():
    child = Child(nickname="Rae", birth_year_month="2020-03", created_by="u1")
    companion_service.delete_companion_file(child)  # must not raise
