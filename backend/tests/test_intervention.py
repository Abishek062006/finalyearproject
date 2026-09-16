"""
The Phase 6 acceptance test (docs/PLAN.md): "engagement decline triggers a
short intervention, and recovery is measured and attributed to the
intervention used." Exercised through session_service exactly as the real
API does, not by calling engine internals directly.
"""
from app.engine.effect_estimator import EffectEstimator
from app.models.experiment import Outcome
from app.models.runtime import InterventionEvent
from app.services import session_service

INTERVENTION_ARMS = {"mini_game", "interest_injection", "modality_switch", "break"}


def test_a_run_of_wrong_answers_triggers_a_short_intervention(seeded_db, child_id):
    session = session_service.start_session(seeded_db, child_id)
    activity = session_service.next_activity(seeded_db, session.id)
    assert activity.spec["is_intervention"] is False  # first round: no history yet, nothing to decline from

    items = activity.spec["items"]
    # 1 correct, then 4 wrong in a row — a clear decline signal.
    session_service.record_answer(seeded_db, activity.id, item_id=items[0]["id"], correct=True, response_time_ms=2000)
    for item in items[1:]:
        session_service.record_answer(seeded_db, activity.id, item_id=item["id"], correct=False, response_time_ms=2000)

    next_one = session_service.next_activity(seeded_db, session.id)
    assert next_one.spec["is_intervention"] is True
    assert next_one.spec["topic_reason"] == "engagement_intervention"
    assert next_one.spec["intervention_type"] in INTERVENTION_ARMS
    assert next_one.spec["items"] == []

    event = seeded_db.query(InterventionEvent).filter_by(session_id=session.id).one()
    assert event.engagement_before < 0.5  # captured the declining state, not a fresh 1.0
    assert event.engagement_after_60s is None  # not yet finalized
    assert event.assignment_id is not None  # linked to the intervention's own arm assignment


def test_no_back_to_back_interventions_and_recovery_is_attributed_to_the_arm_shown(seeded_db, child_id):
    session = session_service.start_session(seeded_db, child_id)
    activity = session_service.next_activity(seeded_db, session.id)
    items = activity.spec["items"]
    session_service.record_answer(seeded_db, activity.id, item_id=items[0]["id"], correct=True, response_time_ms=2000)
    for item in items[1:]:
        session_service.record_answer(seeded_db, activity.id, item_id=item["id"], correct=False, response_time_ms=2000)

    intervention_activity = session_service.next_activity(seeded_db, session.id)
    assert intervention_activity.spec["is_intervention"] is True
    event = seeded_db.query(InterventionEvent).filter_by(session_id=session.id).one()

    # Answering the intervention's single interaction completes it immediately,
    # without touching mastery/retention (there's no "correct answer" concept
    # for e.g. "break").
    session_service.record_answer(seeded_db, intervention_activity.id, item_id=None, correct=True, response_time_ms=500)

    # Fetching again must NOT stack a second intervention on top — the first
    # one's recovery hasn't been measured yet.
    still_no_second_intervention = session_service.next_activity(seeded_db, session.id)
    assert still_no_second_intervention.spec["is_intervention"] is False

    # Answering the next REAL item is what actually measures recovery.
    real_item = still_no_second_intervention.spec["items"][0]
    session_service.record_answer(seeded_db, still_no_second_intervention.id, item_id=real_item["id"], correct=True, response_time_ms=1500)

    seeded_db.refresh(event)
    assert event.engagement_after_60s is not None

    outcomes = seeded_db.query(Outcome).filter_by(assignment_id=event.assignment_id, kind="engagement_60s").all()
    assert len(outcomes) == 1
    assert outcomes[0].value == event.engagement_after_60s


def test_intervention_outcomes_feed_the_same_effect_estimator_as_teaching_axes(seeded_db, child_id):
    """docs/PLAN.md Phase 6: "the SAME Thompson-sampling machinery" — proven
    by checking the intervention axis's posterior actually moves in response
    to a recorded engagement_60s outcome, using the existing EffectEstimator
    unchanged apart from a `kind` parameter."""
    from app.models.experiment import Axis

    axis = seeded_db.query(Axis).filter_by(code="intervention").one()
    from app.models.experiment import Arm

    arm = seeded_db.query(Arm).filter_by(axis_id=axis.id, code="mini_game").one()

    estimator = EffectEstimator(seeded_db)
    before = estimator.posterior(child_id, axis.id, arm.id, kind="engagement_60s")
    assert before.n == 0

    from app.engine.experiment_manager import ArmChoice, ExperimentManager

    manager = ExperimentManager(seeded_db)
    choice = ArmChoice(
        axis_id=axis.id, axis_code=axis.code, arm_id=arm.id, arm_code=arm.code,
        decision_type="explore", reason="test", candidate_arm_ids=[arm.id],
    )
    assignment = manager.record_assignment(child_id, choice, seed=1, posterior_snapshot={}, distress_level=0.0)
    seeded_db.add(Outcome(assignment_id=assignment.id, kind="engagement_60s", value=1.0, n=1))
    seeded_db.commit()

    after = estimator.posterior(child_id, axis.id, arm.id, kind="engagement_60s")
    assert after.n == 1
    assert after.mean > before.mean
