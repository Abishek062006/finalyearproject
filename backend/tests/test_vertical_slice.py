"""
The Phase 2 acceptance test from docs/PLAN.md:
"a 10-minute session produces a clean, analysable interaction log."

Also covers the "decision audit" and "matching check" questions from
docs/SCHEMA.md §9, since those are what make the research claim checkable.
"""
from app.engine.decision_engine import DecisionEngine
from app.engine.experiment_manager import ArmChoice
from app.models.experiment import Assignment, Outcome
from app.models.profile_state import MasteryState
from app.services import session_service


def test_full_loop_creates_a_clean_log(seeded_db, child_id):
    session = session_service.start_session(seeded_db, child_id)
    activity = session_service.next_activity(seeded_db, session.id)

    assert activity.spec["topic_code"] == "num_1_5"
    assert len(activity.spec["items"]) == 5
    assert activity.spec["method"] in ("errorless", "try_then_correct")
    assert activity.spec["modality"] in ("tap", "drag_drop")

    item_id = activity.spec["items"][0]["id"]
    interaction = session_service.record_answer(
        seeded_db, activity.id, item_id=item_id, correct=True, response_time_ms=2000
    )
    assert interaction.correct is True

    mastery = seeded_db.query(MasteryState).filter_by(child_id=child_id).one()
    assert mastery.trials == 1
    assert mastery.p_mastery > 0.5  # moved up from the 0.5 prior after a correct answer

    session_service.end_session(seeded_db, session.id)


def test_every_decision_is_auditable(seeded_db, child_id):
    """docs/SCHEMA.md §9 Q2: for any activity, we must be able to reconstruct
    what was chosen, what else was allowed, and whether it was explore/exploit."""
    session = session_service.start_session(seeded_db, child_id)
    session_service.next_activity(seeded_db, session.id)

    assignments = seeded_db.query(Assignment).filter_by(child_id=child_id).all()
    assert len(assignments) == 2  # teaching_method + modality, per active axes
    for a in assignments:
        assert a.decision_type in ("explore", "exploit", "locked", "safe_fallback")
        assert len(a.candidate_arm_ids) >= 1
        assert a.arm_id in a.candidate_arm_ids
        assert a.random_seed >= 0


def test_matched_item_sets_are_actually_matched(seeded_db):
    """docs/SCHEMA.md §9 Q3: two sets in the same match_group must be equal
    size and within +/-0.2 difficulty mean, or every comparison is confounded."""
    from app.models.curriculum import ItemSet

    sets = seeded_db.query(ItemSet).filter_by(match_group="num_1_5_intro_v1").all()
    assert len(sets) == 2
    sizes = {s.size for s in sets}
    diffs = [s.difficulty_mean for s in sets]
    assert len(sizes) == 1, "matched sets must be equal size"
    assert max(diffs) - min(diffs) <= 0.2, "matched sets must be within +/-0.2 difficulty"


def test_outcomes_are_attributed_to_every_active_axis(seeded_db, child_id):
    """One immediate result should be scored against BOTH the teaching_method
    and modality assignments that produced that activity (docs/ARCHITECTURE.md §5)."""
    session = session_service.start_session(seeded_db, child_id)
    activity = session_service.next_activity(seeded_db, session.id)
    item_id = activity.spec["items"][0]["id"]

    session_service.record_answer(seeded_db, activity.id, item_id=item_id, correct=True, response_time_ms=1500)

    outcomes = seeded_db.query(Outcome).all()
    assert len(outcomes) == 2
    assert all(o.kind == "immediate" and o.value == 1.0 for o in outcomes)


def test_repeated_correct_answers_move_toward_a_confirmed_winner(seeded_db, child_id):
    """Not a statistical proof, just confirms the mechanism: enough consistent
    evidence for one arm should eventually let EffectEstimator declare a winner
    instead of exploring forever."""
    from app.engine.effect_estimator import EffectEstimator
    from app.models.experiment import Axis

    engine = DecisionEngine(seeded_db, random_seed=42)
    axis = seeded_db.query(Axis).filter_by(code="teaching_method").one()
    estimator = EffectEstimator(seeded_db)

    # Manually force 20 "successes" onto one arm to simulate consistent evidence,
    # bypassing the randomness of which arm gets explored first.
    from app.models.experiment import Arm

    arm = seeded_db.query(Arm).filter_by(axis_id=axis.id, code="errorless").one()
    other_arm = seeded_db.query(Arm).filter_by(axis_id=axis.id, code="try_then_correct").one()

    winning_choice = ArmChoice(
        axis_id=axis.id, axis_code=axis.code, arm_id=arm.id, arm_code=arm.code,
        decision_type="explore", reason="test", candidate_arm_ids=[arm.id, other_arm.id],
    )
    losing_choice = ArmChoice(
        axis_id=axis.id, axis_code=axis.code, arm_id=other_arm.id, arm_code=other_arm.code,
        decision_type="explore", reason="test", candidate_arm_ids=[arm.id, other_arm.id],
    )
    # Both arms need real evidence: an unexplored arm's posterior is too wide
    # to be confidently beaten, which is correct behaviour, not a bug — so we
    # give the loser 20 trials at a clearly lower success rate too.
    for _ in range(20):
        a = engine.experiments.record_assignment(child_id, winning_choice, seed=1, posterior_snapshot={}, distress_level=0.0)
        seeded_db.add(Outcome(assignment_id=a.id, kind="immediate", value=1.0, n=1))
    for i in range(20):
        a = engine.experiments.record_assignment(child_id, losing_choice, seed=1, posterior_snapshot={}, distress_level=0.0)
        seeded_db.add(Outcome(assignment_id=a.id, kind="immediate", value=1.0 if i < 6 else 0.0, n=1))
    seeded_db.commit()

    verdict = estimator.winner(child_id, axis.id, [arm.id, other_arm.id])
    assert verdict is not None
    assert verdict.arm_id == arm.id
