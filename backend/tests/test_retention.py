"""
Phase 5: the forgetting curve itself, and the full delayed-outcome loop —
practice a topic -> a 3/7-day probe gets scheduled -> time passes -> the
probe is delivered -> answering it attributes a retention outcome back to
the ORIGINAL teaching assignment (docs/ARCHITECTURE.md §5).
"""
from datetime import datetime, timedelta, timezone

from app.engine.retention_model import RetentionModel
from app.models.experiment import Outcome
from app.models.profile_state import RetentionState
from app.models.runtime import ScheduledProbe
from app.services import educator_service, session_service


def test_retention_decays_over_time_after_a_correct_answer(seeded_db, child_id):
    from app.models.curriculum import Topic

    topic = seeded_db.query(Topic).filter_by(code="num_1_5").one()
    rm = RetentionModel(seeded_db)

    rm.update(child_id, topic.id, correct=True)
    assert rm.current_retention(child_id, topic.id) > 0.99  # practiced "just now"

    row = seeded_db.query(RetentionState).filter_by(child_id=child_id, topic_id=topic.id).one()
    later = datetime.now(timezone.utc) + timedelta(days=row.half_life_days)
    # exactly one half-life later, retention should have dropped to ~half
    assert 0.45 < rm.current_retention(child_id, topic.id, at=later) < 0.55


def test_a_wrong_answer_immediately_lowers_retention_not_just_over_time(seeded_db, child_id):
    """Regression test for the bug fixed in retention_model.py: 2^(-t/h) at
    t=0 is always 1.0 regardless of correctness, which would say "fully
    retained" the instant a child just got it wrong."""
    from app.models.curriculum import Topic

    topic = seeded_db.query(Topic).filter_by(code="num_1_5").one()
    rm = RetentionModel(seeded_db)

    rm.update(child_id, topic.id, correct=False)
    assert rm.current_retention(child_id, topic.id) < 0.5


def test_half_life_grows_on_success_and_shrinks_on_failure(seeded_db, child_id):
    from app.models.curriculum import Topic

    topic = seeded_db.query(Topic).filter_by(code="num_1_5").one()
    rm = RetentionModel(seeded_db)

    initial = seeded_db.query(RetentionState).filter_by(child_id=child_id, topic_id=topic.id).one_or_none()
    assert initial is None  # nothing yet

    rm.update(child_id, topic.id, correct=True)
    # Capture the value now, not the ORM object — it's the same row in
    # SQLAlchemy's identity map, so holding the object and comparing later
    # would silently compare it against its own post-failure mutation.
    half_life_after_success = seeded_db.query(RetentionState).filter_by(child_id=child_id, topic_id=topic.id).one().half_life_days
    assert half_life_after_success > 7.0  # grew from the 7-day default

    rm.update(child_id, topic.id, correct=False)
    half_life_after_failure = seeded_db.query(RetentionState).filter_by(child_id=child_id, topic_id=topic.id).one().half_life_days
    assert half_life_after_failure < half_life_after_success


def test_due_for_revision_only_includes_practiced_topics_below_threshold(seeded_db, child_id):
    from app.models.curriculum import Topic

    topic = seeded_db.query(Topic).filter_by(code="num_1_5").one()
    rm = RetentionModel(seeded_db)

    assert rm.due_for_revision(child_id) == []  # never practiced -> nothing to review

    rm.update(child_id, topic.id, correct=False)  # low retention right away
    candidates = rm.due_for_revision(child_id)
    assert len(candidates) == 1
    assert candidates[0].topic_code == "num_1_5"
    assert candidates[0].retention_percent < 70


def test_fresh_practice_schedules_3_and_7_day_probes_per_assignment(seeded_db, child_id):
    session = session_service.start_session(seeded_db, child_id)
    activity = session_service.next_activity(seeded_db, session.id)
    for item in activity.spec["items"]:
        session_service.record_answer(seeded_db, activity.id, item_id=item["id"], correct=True, response_time_ms=1000)

    probes = seeded_db.query(ScheduledProbe).filter_by(child_id=child_id).all()
    delays = sorted(p.delay_days for p in probes)
    # 3 active axes (teaching_method, modality, theme) x 2 delays (3, 7) = 6 probes
    assert delays == [3, 3, 3, 7, 7, 7]
    assert all(p.status == "pending" for p in probes)
    assert all(p.item_set_id == activity.spec["item_set_id"] for p in probes)


def test_practicing_the_same_topic_again_does_not_spam_duplicate_probes(seeded_db, child_id):
    # Pin to one topic — the test is specifically about re-practicing the
    # SAME topic, which now needs to be explicit since a second topic
    # exists and would otherwise legitimately get picked on round 2 (its
    # mastery starts lower once round 1 raises the first topic's mastery
    # above it — real multi-topic routing, docs/PLAN.md content-breadth
    # follow-up, not a bug).
    educator_service.assign_topic(seeded_db, child_id, "num_1_5", user_id="test-educator")
    session = session_service.start_session(seeded_db, child_id)
    for _ in range(2):
        activity = session_service.next_activity(seeded_db, session.id)
        for item in activity.spec["items"]:
            session_service.record_answer(seeded_db, activity.id, item_id=item["id"], correct=True, response_time_ms=1000)

    probes = seeded_db.query(ScheduledProbe).filter_by(child_id=child_id, status="pending").all()
    assert len(probes) == 6  # still just one pending 3-day + 7-day pair per axis (3 axes), not twelve


def test_a_due_probe_is_delivered_with_the_original_item_set_and_attributes_the_outcome(seeded_db, child_id):
    session = session_service.start_session(seeded_db, child_id)
    first_activity = session_service.next_activity(seeded_db, session.id)
    for item in first_activity.spec["items"]:
        session_service.record_answer(seeded_db, first_activity.id, item_id=item["id"], correct=True, response_time_ms=1000)

    probes = seeded_db.query(ScheduledProbe).filter_by(child_id=child_id, delay_days=3).all()
    assert len(probes) == 3  # one per axis assignment (teaching_method, modality, theme)
    original_assignment_ids = {p.source_assignment_id for p in probes}

    # Force them due now instead of waiting 3 real days.
    for p in probes:
        p.due_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    seeded_db.commit()

    probe_activity = session_service.next_activity(seeded_db, session.id)
    assert probe_activity.spec["topic_reason"] == "due_revision"
    assert probe_activity.spec["item_set_id"] == first_activity.spec["item_set_id"]
    assert set(probe_activity.spec["probe_ids"]) == {p.id for p in probes}

    for item in probe_activity.spec["items"]:
        session_service.record_answer(seeded_db, probe_activity.id, item_id=item["id"], correct=True, response_time_ms=1200)

    delivered = seeded_db.query(ScheduledProbe).filter(ScheduledProbe.id.in_([p.id for p in probes])).all()
    assert all(p.status == "delivered" for p in delivered)
    assert all(p.delivered_activity_instance_id == probe_activity.id for p in delivered)

    retention_outcomes = seeded_db.query(Outcome).filter_by(kind="retention_3d").all()
    # One outcome per (answered item x probe) — mirrors how "immediate"
    # outcomes are recorded once per axis assignment linked to an activity,
    # since each item answered is evidence for both probes' axes.
    assert len(retention_outcomes) == len(probe_activity.spec["items"]) * len(probes)
    assert {o.assignment_id for o in retention_outcomes} == original_assignment_ids


def test_end_session_schedules_an_audit_probe_for_a_topic_believed_mastered(seeded_db, child_id):
    from app.models.curriculum import Topic
    from app.engine.learner_model import LearnerModel

    topic = seeded_db.query(Topic).filter_by(code="num_1_5").one()
    learner = LearnerModel(seeded_db)
    for _ in range(20):
        learner.update(child_id, topic.id, correct=True)  # push mastery well above the audit threshold
    seeded_db.commit()

    session = session_service.start_session(seeded_db, child_id)
    session_service.end_session(seeded_db, session.id)

    audits = seeded_db.query(ScheduledProbe).filter_by(child_id=child_id, delay_days=0).all()
    assert len(audits) == 1
    assert audits[0].source_assignment_id is None  # not tied to any one teaching decision
    assert audits[0].due_at.replace(tzinfo=None) <= datetime.now(timezone.utc).replace(tzinfo=None)


def test_parent_summary_topics_to_review_reflects_retention_not_raw_mastery(seeded_db, child_id):
    from app.services import parent_service

    session = session_service.start_session(seeded_db, child_id)
    activity = session_service.next_activity(seeded_db, session.id)
    # Answer wrong to drive retention down immediately.
    session_service.record_answer(seeded_db, activity.id, item_id=activity.spec["items"][0]["id"], correct=False, response_time_ms=2000)

    body = parent_service.summary(seeded_db, child_id)
    assert len(body["topics_to_review"]) == 1
    assert body["topics_to_review"][0]["retention_percent"] < 70
