"""
Parent-facing business logic. README §2A: understandable terms, no raw model
internals. The "recommendation" here is deliberately a simple rule (lowest
attempted mastery) — RetentionModel-based revision scheduling is Phase 5
(docs/PLAN.md); this is the honest Phase 3 version, not a placeholder pretending
to be more than it is.
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session as DBSession

from app.models.adults import Recommendation
from app.models.curriculum import Domain, Theme, Topic
from app.models.identity import Child, Consent, Guardianship
from app.models.profile_state import InterestState, MasteryState
from app.models.runtime import ActivityInstance, Session as SessionModel

ATTEMPTED_MASTERY_THRESHOLD = 0.65  # below this (and attempted at least once) -> "needs review"
MIN_TRIALS_TO_COUNT = 1


def create_child(db: DBSession, owner_user_id: str, nickname: str, birth_year_month: str, initial_interest_codes: list[str]) -> Child:
    child = Child(nickname=nickname, birth_year_month=birth_year_month, created_by=owner_user_id)
    db.add(child)
    db.flush()
    db.add(Guardianship(user_id=owner_user_id, child_id=child.id, relation="parent"))

    # README §6: parent-selected interests are a PRIOR, never the current
    # value — stored as parent_prior only; effect_mean stays at the model
    # default (0.5) until real randomized theme comparisons update it
    # (InterestModel, docs/PLAN.md Phase 7).
    for code in initial_interest_codes:
        theme = db.query(Theme).filter_by(code=code).one_or_none()
        if theme is None:
            continue
        db.add(InterestState(child_id=child.id, theme_id=theme.id, parent_prior=1.0))

    # README §18: data_collection consent is required at creation; camera
    # defaults to OFF and must be separately, explicitly granted.
    now = datetime.now(timezone.utc)
    db.add(Consent(child_id=child.id, scope="data_collection", granted=True, granted_by=owner_user_id, granted_at=now))
    db.add(Consent(child_id=child.id, scope="camera", granted=False, granted_by=owner_user_id, granted_at=now))

    db.commit()
    db.refresh(child)
    return child


def list_children_for_user(db: DBSession, user_id: str) -> list[Child]:
    return (
        db.query(Child)
        .join(Guardianship, Guardianship.child_id == Child.id)
        .filter(Guardianship.user_id == user_id)
        .all()
    )


def _topic_mastery_percent(db: DBSession, child_id: str, topic_id: str) -> tuple[int, int]:
    """Read-only: does NOT create a MasteryState row for untouched topics
    (unlike LearnerModel.get_mastery, which is meant for the live decision
    path). Returns (percent, trials)."""
    row = db.query(MasteryState).filter_by(child_id=child_id, topic_id=topic_id).one_or_none()
    if row is None:
        return round(0.5 * 100), 0
    return round(row.p_mastery * 100), row.trials


def domain_progress(db: DBSession, child_id: str) -> list[dict]:
    results = []
    for domain in db.query(Domain).order_by(Domain.sort_order).all():
        topics = db.query(Topic).filter_by(domain_id=domain.id).all()
        if not topics:
            continue
        percents = [_topic_mastery_percent(db, child_id, t.id)[0] for t in topics]
        results.append(
            {
                "domain_code": domain.code,
                "domain_label": domain.label,
                "mastery_percent": round(sum(percents) / len(percents)),
            }
        )
    return results


def topics_to_review(db: DBSession, child_id: str, limit: int = 5) -> list[dict]:
    out = []
    for topic in db.query(Topic).all():
        percent, trials = _topic_mastery_percent(db, child_id, topic.id)
        if trials >= MIN_TRIALS_TO_COUNT and percent < ATTEMPTED_MASTERY_THRESHOLD * 100:
            out.append({"topic_id": topic.id, "topic_code": topic.code, "topic_label": topic.label, "mastery_percent": percent})
    out.sort(key=lambda t: t["mastery_percent"])
    return out[:limit]


def ensure_todays_suggestion(db: DBSession, child_id: str) -> None:
    """Generates at most one 'revise' suggestion per child per day, only if
    there is a real candidate (an attempted, struggling topic)."""
    today = datetime.now(timezone.utc).date().isoformat()
    existing = (
        db.query(Recommendation)
        .filter(Recommendation.child_id == child_id, Recommendation.shown_to == "parent")
        .all()
    )
    if any(r.generated_at.date().isoformat() == today for r in existing):
        return

    candidates = topics_to_review(db, child_id, limit=1)
    if not candidates:
        return

    top = candidates[0]
    db.add(
        Recommendation(
            child_id=child_id,
            kind="revise",
            payload={
                "topic_id": top["topic_id"],
                "topic_code": top["topic_code"],
                "topic_label": top["topic_label"],
                "message": f"{top['topic_label']} may benefit from a little more practice.",
            },
            shown_to="parent",
        )
    )
    db.commit()


def todays_suggestions(db: DBSession, child_id: str) -> list[Recommendation]:
    ensure_todays_suggestion(db, child_id)
    today = datetime.now(timezone.utc).date().isoformat()
    return [
        r
        for r in db.query(Recommendation).filter_by(child_id=child_id, shown_to="parent").all()
        if r.generated_at.date().isoformat() == today
    ]


def respond_to_recommendation(db: DBSession, recommendation_id: str, response: str) -> Recommendation:
    rec = db.query(Recommendation).filter_by(id=recommendation_id).one()
    rec.response = response
    rec.responded_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(rec)
    return rec


def summary(db: DBSession, child_id: str) -> dict:
    sessions = db.query(SessionModel).filter_by(child_id=child_id).order_by(SessionModel.started_at.desc()).all()
    learning_minutes_total = sum(s.actual_minutes or 0 for s in sessions)
    activities_completed = (
        db.query(ActivityInstance)
        .join(SessionModel, SessionModel.id == ActivityInstance.session_id)
        .filter(SessionModel.child_id == child_id, ActivityInstance.completed.is_(True))
        .count()
    )
    return {
        "learning_minutes_total": round(learning_minutes_total, 1),
        "activities_completed": activities_completed,
        "domains": domain_progress(db, child_id),
        "topics_to_review": topics_to_review(db, child_id),
        "todays_suggestions": todays_suggestions(db, child_id),
        "recent_sessions": sessions[:10],
    }


def get_consents(db: DBSession, child_id: str) -> list[Consent]:
    """Latest row per scope. Consent history is append-only (docs/SCHEMA.md
    §2) — we never mutate a past row, only insert a new one per action, so
    "current state" is always the most recent row for that scope."""
    rows = db.query(Consent).filter_by(child_id=child_id).order_by(Consent.granted_at.desc()).all()
    latest_by_scope: dict[str, Consent] = {}
    for row in rows:
        latest_by_scope.setdefault(row.scope, row)
    return list(latest_by_scope.values())


def update_consent(db: DBSession, child_id: str, user_id: str, scope: str, granted: bool) -> Consent:
    consent = Consent(
        child_id=child_id, scope=scope, granted=granted, granted_by=user_id, granted_at=datetime.now(timezone.utc)
    )
    db.add(consent)
    db.commit()
    db.refresh(consent)
    return consent
