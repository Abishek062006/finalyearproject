"""
docs/PLAN.md UX-overhaul Phase C: once a child has a parent-chosen companion,
it becomes the guide character on every activity — but must NEVER replace
the theme used for the actual lesson content (counting/matching visuals stay
accurate to whatever prompt_text says), and must NEVER touch the theme-axis
randomized comparison (dino/space/ocean/cars stay the only arms in that
experiment). These tests pin both boundaries down explicitly.
"""
from app.models.identity import Child
from app.services import educator_service, session_service


def _set_fake_companion(db, child_id, name="Trains"):
    child = db.query(Child).filter_by(id=child_id).one()
    child.companion_name = name
    child.companion_image_path = f"companions/{child_id}.jpg"
    child.companion_source_title = "Fake train.jpg"
    db.commit()


def test_a_childs_companion_becomes_the_guide_name_and_image(seeded_db, child_id):
    _set_fake_companion(seeded_db, child_id)

    session = session_service.start_session(seeded_db, child_id)
    activity = session_service.next_activity(seeded_db, session.id)

    assert activity.spec["guide_name"] == "Trains"
    assert activity.spec["companion_image_url"] == f"/media/companions/{child_id}.jpg"


def test_without_a_companion_the_guide_name_falls_back_to_the_themes_own_character(seeded_db, child_id):
    session = session_service.start_session(seeded_db, child_id)
    activity = session_service.next_activity(seeded_db, session.id)

    assert activity.spec["guide_name"] in ("Rex", "Astro", "Splash", "Turbo")
    assert activity.spec["companion_image_url"] is None


def test_a_companion_never_changes_which_theme_the_lesson_content_uses(seeded_db, child_id):
    """The counting/matching visuals must stay accurate to their own theme
    (a "race cars" prompt must show cars, not a train) — the companion only
    ever replaces the decorative guide, never the content-bearing theme."""
    educator_service.assign_topic(seeded_db, child_id, "num_1_5", user_id="test-educator")
    _set_fake_companion(seeded_db, child_id)

    session = session_service.start_session(seeded_db, child_id)
    activity = session_service.next_activity(seeded_db, session.id)

    assert activity.spec["theme"] in ("dino", "space", "ocean", "cars")
    assert activity.spec["guide_name"] == "Trains"  # guide is the companion...
    assert "trains" not in activity.spec["prompt_text"].lower()  # ...but content prompt stays theme-accurate


def test_a_companion_replaces_its_own_name_inside_prompts_that_speak_for_the_guide(seeded_db, child_id):
    """Regression test: prompt_text for kinds like "matching" is pre-baked
    with the THEME's own guide name literally in it (e.g. "Help Turbo match
    them all!") — once a companion is set, that name must be swapped too, or
    the avatar (now the companion's photo) and the words attributed to it
    would name two different characters."""
    educator_service.assign_topic(seeded_db, child_id, "letters_a_e_match", user_id="test-educator")
    session = session_service.start_session(seeded_db, child_id)
    activity_before = session_service.next_activity(seeded_db, session.id)
    builtin_name = activity_before.spec["guide_name"]
    assert builtin_name in activity_before.spec["prompt_text"]  # sanity: the un-companioned prompt really does say it

    _set_fake_companion(seeded_db, child_id)
    session2 = session_service.start_session(seeded_db, child_id)
    activity_after = session_service.next_activity(seeded_db, session2.id)

    assert activity_after.spec["guide_name"] == "Trains"
    assert "Trains" in activity_after.spec["prompt_text"]
    assert builtin_name not in activity_after.spec["prompt_text"]
