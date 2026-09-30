"""
The child's buddy (plan Phase 2) and companion photo (Phase C): one constant
friend — default "Pip", renamable — speaks every activity, whichever of the
four themes the randomized experiment picked; the parent-chosen interest photo
rides along. Neither may ever change which theme the lesson CONTENT uses.
"""
from app.models.identity import Child
from app.services import educator_service, parent_service, session_service

BUILT_IN_GUIDES = ("Rex", "Astro", "Splash", "Turbo")


def _set_fake_companion(db, child_id, name="Trains"):
    child = db.query(Child).filter_by(id=child_id).one()
    child.companion_name = name
    child.companion_image_path = f"companions/{child_id}.jpg"
    child.companion_source_title = "Fake train.jpg"
    db.commit()


def _next(db, child_id):
    session = session_service.start_session(db, child_id)
    return session_service.next_activity(db, session.id)


def test_the_guide_is_always_the_childs_buddy_never_a_theme_character(seeded_db, child_id):
    for _ in range(4):
        activity = _next(seeded_db, child_id)
        assert activity.spec["guide_name"] == "Pip"
        assert not any(name in activity.spec["prompt_text"] for name in BUILT_IN_GUIDES)
        assert not any(name in line for line in activity.spec["encouragement"] for name in BUILT_IN_GUIDES)


def test_the_companion_photo_rides_along_with_the_buddy(seeded_db, child_id):
    _set_fake_companion(seeded_db, child_id)
    activity = _next(seeded_db, child_id)
    assert activity.spec["guide_name"] == "Pip"
    assert activity.spec["companion_image_url"] == f"/media/companions/{child_id}.jpg"


def test_without_a_companion_there_is_no_companion_photo(seeded_db, child_id):
    assert _next(seeded_db, child_id).spec["companion_image_url"] is None


def test_a_companion_never_changes_which_theme_the_lesson_content_uses(seeded_db, child_id):
    """Counting/matching visuals must stay accurate to their own theme (a
    "race cars" prompt must show cars, not a train)."""
    educator_service.assign_topic(seeded_db, child_id, "num_1_5", user_id="test-educator")
    _set_fake_companion(seeded_db, child_id)
    activity = _next(seeded_db, child_id)
    assert activity.spec["theme"] in ("dino", "space", "ocean", "cars")
    assert "trains" not in activity.spec["prompt_text"].lower()


def test_prompts_that_speak_for_the_guide_use_the_buddys_name(seeded_db, child_id):
    """Regression: matching prompts are pre-baked with a theme guide's name
    ("Help Turbo match them all!") — the words must name the friend actually
    on screen."""
    educator_service.assign_topic(seeded_db, child_id, "letters_a_e_match", user_id="test-educator")
    assert "Pip" in _next(seeded_db, child_id).spec["prompt_text"]


def test_renaming_the_buddy_changes_what_it_is_called_everywhere(seeded_db, child_id):
    educator_service.assign_topic(seeded_db, child_id, "letters_a_e_match", user_id="test-educator")
    parent_service.update_child_profile(seeded_db, child_id, {"buddy_name": "bubbles"})
    activity = _next(seeded_db, child_id)
    assert activity.spec["guide_name"] == "Bubbles"
    assert "Bubbles" in activity.spec["prompt_text"]

    parent_service.update_child_profile(seeded_db, child_id, {"buddy_name": ""})  # reset
    assert _next(seeded_db, child_id).spec["guide_name"] == "Pip"


def test_an_unsafe_buddy_name_is_rejected(seeded_db, child_id):
    import pytest

    with pytest.raises(ValueError):
        parent_service.update_child_profile(seeded_db, child_id, {"buddy_name": "kill"})


def test_choosing_a_different_friend_uses_its_own_name(seeded_db, child_id):
    educator_service.assign_topic(seeded_db, child_id, "letters_a_e_match", user_id="test-educator")
    parent_service.update_child_profile(seeded_db, child_id, {"buddy_species": "kiko"})
    activity = _next(seeded_db, child_id)
    assert activity.spec["guide_name"] == "Kiko"
    assert "Kiko" in activity.spec["prompt_text"]


def test_a_custom_name_survives_switching_species(seeded_db, child_id):
    parent_service.update_child_profile(seeded_db, child_id, {"buddy_species": "ember", "buddy_name": "sparkle"})
    parent_service.update_child_profile(seeded_db, child_id, {"buddy_species": "hoot"})
    child = seeded_db.query(Child).filter_by(id=child_id).one()
    assert (child.buddy_species, child.buddy) == ("hoot", "Sparkle")


def test_an_unknown_species_is_rejected(seeded_db, child_id):
    import pytest

    with pytest.raises(ValueError):
        parent_service.update_child_profile(seeded_db, child_id, {"buddy_species": "velociraptor"})
