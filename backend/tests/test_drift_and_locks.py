"""
Two engine-level behaviors added in Phase 4:
1. Drift-triggered re-testing: a confirmed winner whose recent trials have
   regressed should stop being exploited (docs/PLAN.md Phase 4).
2. Arm locks are "latest wins" (append-only, like consent) — an educator
   un-blocking an arm must actually take effect, which a naive
   "any allow=False row ever" check would silently break.
"""
from app.engine.effect_estimator import EffectEstimator
from app.engine.experiment_manager import ArmChoice
from app.engine.safety import TherapistLocks
from app.models.experiment import ArmLock, Axis, Outcome


def _give_arm_outcomes(db, engine, child_id, axis, arm, other_arm, values):
    choice = ArmChoice(
        axis_id=axis.id, axis_code=axis.code, arm_id=arm.id, arm_code=arm.code,
        decision_type="explore", reason="test", candidate_arm_ids=[arm.id, other_arm.id],
    )
    for v in values:
        a = engine.experiments.record_assignment(child_id, choice, seed=1, posterior_snapshot={}, distress_level=0.0)
        db.add(Outcome(assignment_id=a.id, kind="immediate", value=v, n=1))
    db.commit()


def test_drift_reopens_exploration_for_a_regressing_winner(seeded_db, child_id):
    from app.engine.decision_engine import DecisionEngine

    engine = DecisionEngine(seeded_db, random_seed=1)
    axis = seeded_db.query(Axis).filter_by(code="teaching_method").one()
    from app.models.experiment import Arm

    winner_arm = seeded_db.query(Arm).filter_by(axis_id=axis.id, code="errorless").one()
    loser_arm = seeded_db.query(Arm).filter_by(axis_id=axis.id, code="try_then_correct").one()
    estimator = EffectEstimator(seeded_db)

    # Establish a confident, confirmed winner: 15 successes for one arm,
    # a clearly worse record for the other.
    _give_arm_outcomes(seeded_db, engine, child_id, axis, winner_arm, loser_arm, [1.0] * 15)
    _give_arm_outcomes(seeded_db, engine, child_id, axis, loser_arm, winner_arm, [1.0, 0, 0, 0, 0] * 3)

    verdict = estimator.winner(child_id, axis.id, [winner_arm.id, loser_arm.id])
    assert verdict is not None
    assert verdict.arm_id == winner_arm.id

    # Now the "winning" arm regresses sharply over its most recent trials —
    # a real change in the child, not noise.
    _give_arm_outcomes(seeded_db, engine, child_id, axis, winner_arm, loser_arm, [0.0] * 5)

    assert estimator.drift_detected(child_id, axis.id, winner_arm.id) is True
    assert estimator.winner(child_id, axis.id, [winner_arm.id, loser_arm.id]) is None


def test_unblocking_an_arm_actually_takes_effect(seeded_db, child_id):
    """Regression test for the bug fixed in app/engine/safety.py: reading
    only allow=False rows would make an educator's later allow=True row
    invisible, permanently locking the arm out."""
    axis = seeded_db.query(Axis).filter_by(code="modality").one()
    from app.models.experiment import Arm

    tap_arm = seeded_db.query(Arm).filter_by(axis_id=axis.id, code="tap").one()
    drag_arm = seeded_db.query(Arm).filter_by(axis_id=axis.id, code="drag_drop").one()
    all_ids = [tap_arm.id, drag_arm.id]

    locks = TherapistLocks(seeded_db)
    assert locks.allowed_arms(child_id, axis.id, all_ids) == all_ids  # nothing locked yet

    seeded_db.add(ArmLock(child_id=child_id, axis_id=axis.id, arm_id=drag_arm.id, locked_by=child_id, allow=False))
    seeded_db.commit()
    assert locks.allowed_arms(child_id, axis.id, all_ids) == [tap_arm.id]

    # Educator changes their mind and re-allows it — a NEW row, never
    # mutating the old one (append-only, docs/SCHEMA.md §6).
    seeded_db.add(ArmLock(child_id=child_id, axis_id=axis.id, arm_id=drag_arm.id, locked_by=child_id, allow=True))
    seeded_db.commit()
    assert set(locks.allowed_arms(child_id, axis.id, all_ids)) == set(all_ids)
