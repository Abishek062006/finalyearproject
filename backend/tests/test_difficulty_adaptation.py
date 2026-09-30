"""Difficulty adapts from the child's real recent performance on a topic:
fast, accurate work steps up a level; struggling steps down; the item set
served always matches the level chosen."""
from app.models.curriculum import ItemSet
from app.services import educator_service, session_service


def _play(db, session_id, correct: bool, response_time_ms: int):
    activity = session_service.next_activity(db, session_id)
    for item in activity.spec["items"]:
        session_service.record_answer(db, activity.id, item_id=item["id"], correct=correct, response_time_ms=response_time_ms)
    return activity


def _next_lesson(db, session_id):
    """Struggling can first trigger a re-engagement intervention (no level of
    its own); finish it, then the next lesson shows the new level."""
    activity = session_service.next_activity(db, session_id)
    while activity.spec["is_intervention"]:
        session_service.record_answer(db, activity.id, item_id=None, correct=True, response_time_ms=1000)
        activity = session_service.next_activity(db, session_id)
    return activity


def _item_set_level(db, activity) -> float:
    return db.query(ItemSet).filter_by(id=activity.item_set_id).one().difficulty_mean


def test_new_child_starts_at_level_1(seeded_db, child_id):
    educator_service.assign_topic(seeded_db, child_id, "num_1_5", user_id="t")
    session = session_service.start_session(seeded_db, child_id)
    activity = session_service.next_activity(seeded_db, session.id)
    assert activity.spec["difficulty"] == 1
    assert _item_set_level(seeded_db, activity) == 1.0


def test_fast_accurate_work_steps_up_one_level_at_a_time_and_caps_at_3(seeded_db, child_id):
    educator_service.assign_topic(seeded_db, child_id, "num_1_5", user_id="t")
    session = session_service.start_session(seeded_db, child_id)
    levels = []
    for _ in range(4):
        activity = _play(seeded_db, session.id, correct=True, response_time_ms=1500)
        levels.append(activity.spec["difficulty"])
        assert _item_set_level(seeded_db, activity) == float(activity.spec["difficulty"])
    assert levels == [1, 2, 3, 3]


def test_struggling_steps_back_down(seeded_db, child_id):
    educator_service.assign_topic(seeded_db, child_id, "num_1_5", user_id="t")
    session = session_service.start_session(seeded_db, child_id)
    _play(seeded_db, session.id, correct=True, response_time_ms=1500)  # level 1
    _play(seeded_db, session.id, correct=True, response_time_ms=1500)  # level 2
    _play(seeded_db, session.id, correct=False, response_time_ms=9000)  # level 3, struggles
    assert _next_lesson(seeded_db, session.id).spec["difficulty"] == 2


def test_accurate_but_slow_work_holds_the_level(seeded_db, child_id):
    educator_service.assign_topic(seeded_db, child_id, "num_1_5", user_id="t")
    session = session_service.start_session(seeded_db, child_id)
    _play(seeded_db, session.id, correct=True, response_time_ms=5000)
    assert session_service.next_activity(seeded_db, session.id).spec["difficulty"] == 1
