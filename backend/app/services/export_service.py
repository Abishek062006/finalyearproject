"""
Data export (docs/PLAN.md Phase 9 pilot-readiness: "data export";
docs/ARCHITECTURE.md §7/§9: "GET /educator/{child_id}/export -> anonymized
research export", "pseudonymous (child_hash), and consent state is checked
before any export").

Two distinct things, not one:
  - A PARENT'S full export of their own child's data (data portability) —
    never anonymized (they already know who their child is), gated only by
    guardianship, not by the research_use consent scope.
  - The ANONYMIZED RESEARCH export (educator/researcher-facing) — pseudonymous
    (keyed by `research_hash`, never child_id/nickname), and gated on the
    research_use consent scope actually being granted, per
    docs/ARCHITECTURE.md §9.

Both are built from the same underlying gather_child_data() so the two
exports can never silently drift apart on what data exists.
"""
from sqlalchemy.orm import Session as DBSession

from app.models.experiment import Assignment, Outcome
from app.models.identity import Child, Consent
from app.models.profile_state import EngagementState
from app.models.runtime import ActivityInstance, Interaction, ScheduledProbe, Session as SessionModel


def _row_to_dict(row, exclude: set[str] = frozenset()) -> dict:
    return {c.name: getattr(row, c.name) for c in row.__table__.columns if c.name not in exclude}


def gather_child_data(db: DBSession, child_id: str) -> dict:
    child = db.query(Child).filter_by(id=child_id).one()
    sessions = db.query(SessionModel).filter_by(child_id=child_id).all()
    session_ids = [s.id for s in sessions]
    activities = (
        db.query(ActivityInstance).filter(ActivityInstance.session_id.in_(session_ids)).all() if session_ids else []
    )
    activity_ids = [a.id for a in activities]
    interactions = (
        db.query(Interaction).filter(Interaction.activity_instance_id.in_(activity_ids)).all() if activity_ids else []
    )
    assignments = db.query(Assignment).filter_by(child_id=child_id).all()
    assignment_ids = [a.id for a in assignments]
    outcomes = db.query(Outcome).filter(Outcome.assignment_id.in_(assignment_ids)).all() if assignment_ids else []
    probes = db.query(ScheduledProbe).filter_by(child_id=child_id).all()
    engagement = db.query(EngagementState).filter_by(child_id=child_id).all()

    return {
        "child_id": child.id,
        "research_hash": child.research_hash,
        "nickname": child.nickname,
        "birth_year_month": child.birth_year_month,
        "sessions": [_row_to_dict(s) for s in sessions],
        "activity_instances": [_row_to_dict(a) for a in activities],
        "interactions": [_row_to_dict(i) for i in interactions],
        "assignments": [_row_to_dict(a) for a in assignments],
        "outcomes": [_row_to_dict(o) for o in outcomes],
        "scheduled_probes": [_row_to_dict(p) for p in probes],
        "engagement_state": [_row_to_dict(e) for e in engagement],
    }


def export_for_parent(db: DBSession, child_id: str) -> dict:
    """Full, non-anonymized — the parent already knows who their own child
    is; this is a data-portability export, not a research artifact."""
    return gather_child_data(db, child_id)


def export_for_research(db: DBSession, child_id: str) -> dict:
    """Pseudonymous: `child_id`/`nickname` are dropped entirely and replaced
    with `research_hash` everywhere a child is identified. Caller MUST check
    the research_use consent scope before calling this — this function does
    not check it itself, since "was consent checked" needs to be a caller-
    visible decision (so an API layer can return a clean 403), not a silent
    empty result."""
    data = gather_child_data(db, child_id)
    research_hash = data["research_hash"]
    return {
        "child_hash": research_hash,
        "birth_year_month": data["birth_year_month"],
        "sessions": [{**s, "child_id": research_hash} for s in data["sessions"]],
        "activity_instances": data["activity_instances"],
        "interactions": data["interactions"],
        "assignments": [{**a, "child_id": research_hash} for a in data["assignments"]],
        "outcomes": data["outcomes"],
        "scheduled_probes": [{**p, "child_id": research_hash} for p in data["scheduled_probes"]],
        "engagement_state": [{**e, "child_id": research_hash} for e in data["engagement_state"]],
    }


def has_research_use_consent(db: DBSession, child_id: str) -> bool:
    latest = (
        db.query(Consent)
        .filter_by(child_id=child_id, scope="research_use")
        .order_by(Consent.granted_at.desc())
        .first()
    )
    return latest is not None and latest.granted
