"""Topics are mixed: a topic from either of the child's last two lessons
sits out the next one — across sessions too — while others are available
(an educator's explicit assignment still wins)."""
from app.services import session_service


def _finish(db, activity):
    for item in activity.spec["items"]:
        session_service.record_answer(db, activity.id, item_id=item["id"], correct=False, response_time_ms=1500)


def test_any_three_lessons_in_a_row_are_three_different_topics_even_across_sessions(seeded_db, child_id):
    topics = []
    for i in range(10):
        if i % 4 == 0:
            session = session_service.start_session(seeded_db, child_id)
        activity = session_service.next_activity(seeded_db, session.id)
        if activity.spec["is_intervention"]:
            session_service.record_answer(seeded_db, activity.id, item_id=None, correct=True, response_time_ms=1000)
            continue
        topics.append(activity.spec["topic_code"])
        _finish(seeded_db, activity)
    for i in range(len(topics) - 2):
        assert len(set(topics[i : i + 3])) == 3, topics


def test_a_topic_with_several_lessons_never_repeats_the_same_one_back_to_back(seeded_db, child_id):
    from app.services import educator_service

    educator_service.assign_topic(seeded_db, child_id, "daily_routines", user_id="t")
    session = session_service.start_session(seeded_db, child_id)
    routines = []
    while len(routines) < 6:
        activity = session_service.next_activity(seeded_db, session.id)
        if activity.spec["is_intervention"]:
            session_service.record_answer(seeded_db, activity.id, item_id=None, correct=True, response_time_ms=1000)
            continue
        routines.append(activity.spec["items"][0]["answer"]["routine"])
        for item in activity.spec["items"]:
            session_service.record_answer(seeded_db, activity.id, item_id=item["id"], correct=True, response_time_ms=5000)
    assert all(a != b for a, b in zip(routines, routines[1:])), routines
