"""
Wires the engine to persistence for the Phase 2 vertical slice:

  start_session -> next_activity -> record_events (repeat) -> end_session

This is the only place that turns DecisionEngine output into rows in
activity_instances / activity_instance_assignments, and turns child answers
into Interaction rows + LearnerModel/EffectEstimator updates. Kept out of the
API layer so it can be unit-tested without HTTP (docs/PLAN.md Phase 2).
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session as DBSession

from app.engine.decision_engine import DecisionEngine
from app.models.runtime import (
    ActivityInstance,
    ActivityInstanceAssignment,
    Interaction,
    Session as SessionModel,
)
from app.models.experiment import Outcome
from app.engine.learner_model import LearnerModel


def start_session(db: DBSession, child_id: str, planned_minutes: float = 15.0) -> SessionModel:
    session = SessionModel(
        child_id=child_id,
        started_at=datetime.now(timezone.utc),
        planned_minutes=planned_minutes,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def next_activity(db: DBSession, session_id: str) -> ActivityInstance:
    session = db.query(SessionModel).filter_by(id=session_id).one()
    engine = DecisionEngine(db)
    spec = engine.decide(session.child_id)

    spec_json = {
        "topic_id": spec.topic_id,
        "topic_code": spec.topic_code,
        "topic_reason": spec.topic_reason,
        "difficulty": spec.difficulty,
        "method": spec.method_arm.arm_code if spec.method_arm else None,
        "modality": spec.modality_arm.arm_code if spec.modality_arm else None,
        "decision_types": {
            "teaching_method": spec.method_arm.decision_type if spec.method_arm else None,
            "modality": spec.modality_arm.decision_type if spec.modality_arm else None,
        },
        "theme": spec.theme_code,
        "item_set_id": spec.item_set_id,
        "items": spec.items,
    }

    activity = ActivityInstance(
        session_id=session_id,
        topic_id=spec.topic_id,
        item_set_id=spec.item_set_id,
        spec=spec_json,
        started_at=datetime.now(timezone.utc),
    )
    db.add(activity)
    db.flush()

    for arm_choice in (spec.method_arm, spec.modality_arm):
        if arm_choice is None:
            continue
        # find the assignment just recorded for this axis (most recent for this child+axis)
        from app.models.experiment import Assignment

        assignment = (
            db.query(Assignment)
            .filter_by(child_id=session.child_id, axis_id=arm_choice.axis_id, arm_id=arm_choice.arm_id)
            .order_by(Assignment.created_at.desc())
            .first()
        )
        if assignment:
            db.add(ActivityInstanceAssignment(activity_instance_id=activity.id, assignment_id=assignment.id))

    db.commit()
    db.refresh(activity)
    return activity


def record_answer(
    db: DBSession,
    activity_instance_id: str,
    item_id: str | None,
    correct: bool,
    response_time_ms: int,
    attempts: int = 1,
    hints_used: int = 0,
) -> Interaction:
    activity = db.query(ActivityInstance).filter_by(id=activity_instance_id).one()
    session = db.query(SessionModel).filter_by(id=activity.session_id).one()
    now = datetime.now(timezone.utc)

    interaction = Interaction(
        activity_instance_id=activity_instance_id,
        item_id=item_id,
        kind="answer",
        correct=correct,
        response_time_ms=response_time_ms,
        attempts=attempts,
        hints_used=hints_used,
        device_time=now,
        server_time=now,
    )
    db.add(interaction)

    LearnerModel(db).update(session.child_id, activity.topic_id, correct)

    for link in db.query(ActivityInstanceAssignment).filter_by(activity_instance_id=activity_instance_id):
        db.add(Outcome(assignment_id=link.assignment_id, kind="immediate", value=1.0 if correct else 0.0, n=1))

    # An activity is "completed" once every item in its matched set has been
    # answered — this is what the parent dashboard's "activities completed"
    # count reads (app/services/parent_service.py). Was previously never set.
    total_items = len(activity.spec.get("items", []))
    answered_items = (
        db.query(Interaction)
        .filter_by(activity_instance_id=activity_instance_id, kind="answer")
        .count()
    )
    if total_items and answered_items >= total_items and not activity.completed:
        activity.completed = True
        activity.ended_at = now

    db.commit()
    db.refresh(interaction)
    return interaction


def end_session(db: DBSession, session_id: str, end_reason: str = "completed") -> SessionModel:
    session = db.query(SessionModel).filter_by(id=session_id).one()
    session.ended_at = datetime.now(timezone.utc)
    session.end_reason = end_reason
    if session.started_at:
        # SQLite drops tzinfo on round-trip, so started_at may come back naive
        # even though it was stored as an aware UTC timestamp — normalize both
        # sides to naive UTC before subtracting rather than assume either shape.
        started = session.started_at.replace(tzinfo=None)
        ended = session.ended_at.replace(tzinfo=None)
        session.actual_minutes = (ended - started).total_seconds() / 60
    db.commit()
    db.refresh(session)
    return session
