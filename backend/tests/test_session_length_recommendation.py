"""
README §19: "an individualized learning window based on observed
interaction history" — not a fixed duration, and not a clinical attention-
span measurement.
"""
from app.models.profile_state import EngagementState
from app.services import parent_service, session_service


def test_no_recommendation_until_a_session_has_finished(seeded_db, child_id):
    body = parent_service.summary(seeded_db, child_id)
    assert body["recommended_session_minutes"] is None


def test_a_finished_session_produces_a_recommendation_within_the_sane_band(seeded_db, child_id):
    session = session_service.start_session(seeded_db, child_id)
    activity = session_service.next_activity(seeded_db, session.id)
    for item in activity.spec["items"]:
        session_service.record_answer(seeded_db, activity.id, item_id=item["id"], correct=True, response_time_ms=1000)
    session_service.end_session(seeded_db, session.id)

    body = parent_service.summary(seeded_db, child_id)
    assert body["recommended_session_minutes"] is not None
    assert 10.0 <= body["recommended_session_minutes"] <= 30.0

    row = seeded_db.query(EngagementState).filter_by(child_id=child_id).one()
    assert row.distress_events == 0  # no intervention fired in this short, all-correct session
    assert row.mean_engagement is not None


def test_a_session_with_a_decline_records_distress_events_and_a_shorter_decline_window(seeded_db, child_id):
    session = session_service.start_session(seeded_db, child_id)
    activity = session_service.next_activity(seeded_db, session.id)
    items = activity.spec["items"]
    session_service.record_answer(seeded_db, activity.id, item_id=items[0]["id"], correct=True, response_time_ms=1000)
    for item in items[1:]:
        session_service.record_answer(seeded_db, activity.id, item_id=item["id"], correct=False, response_time_ms=1000)

    intervention = session_service.next_activity(seeded_db, session.id)
    assert intervention.spec["is_intervention"] is True
    session_service.record_answer(seeded_db, intervention.id, item_id=None, correct=True, response_time_ms=500)

    session_service.end_session(seeded_db, session.id)

    row = seeded_db.query(EngagementState).filter_by(child_id=child_id).one()
    assert row.distress_events == 1
    assert row.decline_after_minutes is not None
