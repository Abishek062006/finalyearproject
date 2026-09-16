"""
EngagementModel: the observable-behaviour signals (README §14) — never a
diagnosis, just error streaks / response-time trend / abandonment turned
into a three-state estimate.
"""
from datetime import datetime, timedelta, timezone

from app.engine.engagement_model import EngagementModel
from app.models.runtime import ActivityInstance, Interaction, Session as SessionModel


def _make_activity(db, child_id: str, session_id: str) -> ActivityInstance:
    activity = ActivityInstance(
        session_id=session_id, topic_id="topicA", item_set_id=None,
        spec={"items": []}, started_at=datetime.now(timezone.utc),
    )
    db.add(activity)
    db.flush()
    return activity


def _answer(db, activity_id: str, correct: bool, response_time_ms: int, when: datetime):
    db.add(
        Interaction(
            activity_instance_id=activity_id, item_id=None, kind="answer", correct=correct,
            response_time_ms=response_time_ms, attempts=1, hints_used=0, device_time=when, server_time=when,
        )
    )


def test_too_few_interactions_reads_as_stable(seeded_db, child_id):
    session = SessionModel(child_id=child_id, started_at=datetime.now(timezone.utc))
    seeded_db.add(session)
    seeded_db.flush()
    activity = _make_activity(seeded_db, child_id, session.id)
    _answer(seeded_db, activity.id, True, 2000, datetime.now(timezone.utc))
    seeded_db.commit()

    reading = EngagementModel(seeded_db).estimate(child_id, session.id)
    assert reading.state == "stable"
    assert reading.n_considered == 1


def test_a_run_of_wrong_answers_reads_as_declining(seeded_db, child_id):
    session = SessionModel(child_id=child_id, started_at=datetime.now(timezone.utc))
    seeded_db.add(session)
    seeded_db.flush()
    activity = _make_activity(seeded_db, child_id, session.id)

    now = datetime.now(timezone.utc)
    for i, correct in enumerate([True, True, False, False]):
        _answer(seeded_db, activity.id, correct, 2000, now + timedelta(seconds=i))
    seeded_db.commit()

    reading = EngagementModel(seeded_db).estimate(child_id, session.id)
    assert reading.state == "declining"
    assert reading.recent_error_streak == 2


def test_slowing_response_times_read_as_declining(seeded_db, child_id):
    session = SessionModel(child_id=child_id, started_at=datetime.now(timezone.utc))
    seeded_db.add(session)
    seeded_db.flush()
    activity = _make_activity(seeded_db, child_id, session.id)

    now = datetime.now(timezone.utc)
    # a fast, confident baseline, then a clearly slower recent run — same
    # correctness throughout, so only the timing trend should trigger this.
    times = [1500, 1600, 1500, 1700, 4000, 4200, 4100, 4300, 4400]
    for i, rt in enumerate(times):
        _answer(seeded_db, activity.id, True, rt, now + timedelta(seconds=i))
    seeded_db.commit()

    reading = EngagementModel(seeded_db).estimate(child_id, session.id)
    assert reading.state == "declining"
    assert reading.recent_error_streak == 0


def test_fast_accurate_answers_read_as_high(seeded_db, child_id):
    session = SessionModel(child_id=child_id, started_at=datetime.now(timezone.utc))
    seeded_db.add(session)
    seeded_db.flush()
    activity = _make_activity(seeded_db, child_id, session.id)

    now = datetime.now(timezone.utc)
    for i in range(8):
        _answer(seeded_db, activity.id, True, 1500, now + timedelta(seconds=i))
    seeded_db.commit()

    reading = EngagementModel(seeded_db).estimate(child_id, session.id)
    assert reading.state == "high"
