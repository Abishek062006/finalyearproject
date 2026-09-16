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
from app.engine.engagement_model import EngagementModel, engagement_score
from app.engine.intervention_model import InterventionModel
from app.engine.retention_model import RetentionModel
from app.models.profile_state import EngagementState
from app.models.runtime import (
    ActivityInstance,
    ActivityInstanceAssignment,
    Interaction,
    InterventionEvent,
    ScheduledProbe,
    Session as SessionModel,
)
from app.models.experiment import Assignment, Outcome
from app.engine.learner_model import LearnerModel

MIN_RECOMMENDED_SESSION_MINUTES = 10.0
MAX_RECOMMENDED_SESSION_MINUTES = 30.0
RECOMMENDATION_HISTORY_DAYS = 5


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


def _find_assignment(db: DBSession, child_id: str, axis_id: str, arm_id: str) -> Assignment | None:
    """Most recent Assignment for this child+axis+arm — DecisionEngine
    already recorded it a moment ago; this just finds it again to link."""
    return (
        db.query(Assignment)
        .filter_by(child_id=child_id, axis_id=axis_id, arm_id=arm_id)
        .order_by(Assignment.created_at.desc())
        .first()
    )


def next_activity(db: DBSession, session_id: str) -> ActivityInstance:
    session = db.query(SessionModel).filter_by(id=session_id).one()
    engine = DecisionEngine(db)
    spec = engine.decide(session.child_id, session_id)

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
        "probe_ids": spec.probe_ids,
        "is_intervention": spec.is_intervention,
        "intervention_type": spec.intervention_arm.arm_code if spec.intervention_arm else None,
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

    if spec.is_intervention:
        # README §15/§16 / docs/PLAN.md Phase 6: a short, conditionally-
        # triggered re-engagement interlude — not a teaching decision, so it
        # gets its own InterventionEvent rather than an ActivityInstanceAssignment.
        assignment = _find_assignment(db, session.child_id, spec.intervention_arm.axis_id, spec.intervention_arm.arm_id)
        InterventionModel(db).record_start(
            session_id=session_id,
            engagement_before=spec.engagement_before,
            arm_id=spec.intervention_arm.arm_id,
            assignment_id=assignment.id if assignment else None,
        )
    else:
        for arm_choice in (spec.method_arm, spec.modality_arm):
            if arm_choice is None:
                continue
            assignment = _find_assignment(db, session.child_id, arm_choice.axis_id, arm_choice.arm_id)
            if assignment:
                db.add(ActivityInstanceAssignment(activity_instance_id=activity.id, assignment_id=assignment.id))

    # Mark every ScheduledProbe this activity fulfills as delivered, so it
    # won't be picked again (docs/PLAN.md Phase 5). The actual retention
    # outcome is recorded per-answer in record_answer, once we know correct/incorrect.
    if spec.probe_ids:
        for probe in db.query(ScheduledProbe).filter(ScheduledProbe.id.in_(spec.probe_ids)).all():
            probe.status = "delivered"
            probe.delivered_activity_instance_id = activity.id

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

    if activity.spec.get("is_intervention"):
        # README §15/§16: a re-engagement interlude, not a teaching decision
        # — no LearnerModel/RetentionModel update, no "immediate" teaching
        # outcome (correctness isn't a meaningful concept for e.g. "break" or
        # "mini_game"). One interaction always completes it. Whether it
        # actually helped is measured on the child's NEXT real answer, below.
        activity.completed = True
        activity.ended_at = now
        db.commit()
        db.refresh(interaction)
        return interaction

    InterventionModel(db).finalize_pending(session.child_id, session.id)

    retention_model = RetentionModel(db)
    LearnerModel(db).update(session.child_id, activity.topic_id, correct)
    retention_model.update(session.child_id, activity.topic_id, correct)  # every answer is evidence for the forgetting curve

    for link in db.query(ActivityInstanceAssignment).filter_by(activity_instance_id=activity_instance_id):
        db.add(Outcome(assignment_id=link.assignment_id, kind="immediate", value=1.0 if correct else 0.0, n=1))

    # If this activity is fulfilling one or more delayed retention probes
    # (docs/PLAN.md Phase 5), attribute the result back to the ORIGINAL
    # teaching assignment that scheduled each one — this is the delayed-
    # outcome half of the research design (docs/ARCHITECTURE.md §5). Audit
    # probes (delay_days=0) have no source assignment to attribute to; they
    # exist purely to correct LearnerModel/RetentionModel's own beliefs.
    probe_ids: list[str] = activity.spec.get("probe_ids") or []
    if probe_ids:
        for probe in db.query(ScheduledProbe).filter(ScheduledProbe.id.in_(probe_ids)).all():
            if probe.delay_days in (3, 7) and probe.source_assignment_id:
                db.add(
                    Outcome(
                        assignment_id=probe.source_assignment_id,
                        kind=f"retention_{probe.delay_days}d",
                        value=1.0 if correct else 0.0,
                        n=1,
                    )
                )

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

        # Freshly-practiced (not itself a probe delivery) -> schedule 3-day
        # and 7-day check-backs per teaching assignment involved, so future
        # results can be attributed back to this specific method/modality
        # (docs/PLAN.md Phase 5). Probe-delivery activities don't chain into
        # further probes here — that would need a full ongoing spaced-
        # repetition scheduler, out of this phase's scope.
        if not probe_ids:
            assignment_ids = [
                link.assignment_id
                for link in db.query(ActivityInstanceAssignment).filter_by(activity_instance_id=activity_instance_id).all()
            ]
            retention_model.schedule_probes_for_assignments(session.child_id, activity.topic_id, activity.item_set_id, assignment_ids)

    db.commit()
    db.refresh(interaction)
    return interaction


def _record_engagement_summary(db: DBSession, session: SessionModel, started: datetime, ended: datetime) -> None:
    """README §19/docs/PLAN.md Phase 6: "an individualized learning window
    based on observed interaction history" — NOT a fixed duration for every
    child, and not a clinical measure of attention span. Recommendation is
    the recent average of how long engagement actually held up before the
    first sign of decline, clipped to a sane band."""
    session_minutes = max(0.1, (ended - started).total_seconds() / 60)

    interventions = (
        db.query(InterventionEvent)
        .filter_by(session_id=session.id)
        .order_by(InterventionEvent.triggered_at.asc())
        .all()
    )
    if interventions:
        first_decline = interventions[0].triggered_at.replace(tzinfo=None)
        decline_after_minutes = max(0.1, (first_decline - started).total_seconds() / 60)
    else:
        decline_after_minutes = session_minutes  # engagement never declined this session

    reading = EngagementModel(db).estimate(session.child_id, session.id)
    today = ended.date().isoformat()

    row = db.query(EngagementState).filter_by(child_id=session.child_id, date=today).one_or_none()
    if row is None:
        row = EngagementState(child_id=session.child_id, date=today)
        db.add(row)
        db.flush()
    row.mean_engagement = engagement_score(reading)
    row.decline_after_minutes = decline_after_minutes
    row.distress_events = len(interventions)

    history = (
        db.query(EngagementState)
        .filter(
            EngagementState.child_id == session.child_id,
            EngagementState.date != today,
            EngagementState.decline_after_minutes.isnot(None),
        )
        .order_by(EngagementState.date.desc())
        .limit(RECOMMENDATION_HISTORY_DAYS)
        .all()
    )
    samples = [h.decline_after_minutes for h in history] + [decline_after_minutes]
    avg_decline = sum(samples) / len(samples)
    row.recommended_session_minutes = round(min(MAX_RECOMMENDED_SESSION_MINUTES, max(MIN_RECOMMENDED_SESSION_MINUTES, avg_decline)), 1)
    db.flush()


def end_session(db: DBSession, session_id: str, end_reason: str = "completed") -> SessionModel:
    session = db.query(SessionModel).filter_by(id=session_id).one()

    # README §13/docs/PLAN.md Phase 5: an occasional, confidence-independent
    # spot-check on something the model currently believes is mastered.
    # A natural point to consider this is once per finished session, not
    # mid-lesson.
    RetentionModel(db).maybe_schedule_audit_probes(session.child_id)

    session.ended_at = datetime.now(timezone.utc)
    session.end_reason = end_reason
    if session.started_at:
        # SQLite drops tzinfo on round-trip, so started_at may come back naive
        # even though it was stored as an aware UTC timestamp — normalize both
        # sides to naive UTC before subtracting rather than assume either shape.
        started = session.started_at.replace(tzinfo=None)
        ended = session.ended_at.replace(tzinfo=None)
        session.actual_minutes = (ended - started).total_seconds() / 60
        _record_engagement_summary(db, session, started, ended)
    db.commit()
    db.refresh(session)
    return session
