"""
Parent-facing business logic. README §2A: understandable terms, no raw model
internals.
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session as DBSession

from app.engine.effect_estimator import EffectEstimator, MIN_EVIDENCE_TRIALS
from app.engine.experiment_manager import ExperimentManager
from app.engine.retention_model import RetentionModel
from app.models.adults import Recommendation
from app.models.curriculum import Domain, Theme, Topic
from app.models.experiment import Axis
from app.models.identity import Child, Consent, EducatorLink, Guardianship, User
from app.models.profile_state import EngagementState, InterestState, MasteryState
from app.models.runtime import ActivityInstance, Session as SessionModel

THEME_AXIS_CODE = "theme"


COMMUNICATION_LEVELS = {"sentences", "words", "gestures", "non_speaking"}
SENSORY_FLAGS = {"sounds", "lights", "motion", "timers"}


def create_child(db: DBSession, owner_user_id: str, nickname: str, birth_year_month: str, initial_interest_codes: list[str]) -> Child:
    child = _create_child_rows(db, owner_user_id, nickname, birth_year_month, initial_interest_codes)
    db.commit()
    db.refresh(child)
    return child


def _validate_profile(communication_level: str | None, sensory: list[str] | None, goals: list[str] | None) -> None:
    if communication_level is not None and communication_level not in COMMUNICATION_LEVELS:
        raise ValueError(f"Unknown communication level: {communication_level}")
    if sensory is not None and not set(sensory) <= SENSORY_FLAGS:
        raise ValueError(f"Unknown sensory flags: {sorted(set(sensory) - SENSORY_FLAGS)}")


def _validate_buddy(species: str | None, name: str | None) -> None:
    from app.models.identity import BUDDY_SPECIES
    from app.services.companion_service import validate_query

    if species is not None and species not in BUDDY_SPECIES:
        raise ValueError(f"Unknown learning friend: {species}")
    if name and name.strip() and validate_query(name.strip()):
        raise ValueError("The friend's name should be a short, simple word.")


def _validate_goals(db: DBSession, goals: list[str] | None) -> None:
    if not goals:
        return
    known = {d.code for d in db.query(Domain).all()}
    if not set(goals) <= known:
        raise ValueError(f"Unknown goals: {sorted(set(goals) - known)}")


def onboard_child(
    db: DBSession,
    owner_user_id: str,
    nickname: str,
    birth_year_month: str,
    communication_level: str | None,
    sensory: list[str],
    goals: list[str],
    interests: list[dict],
    buddy_species: str = "pip",
    buddy_name: str | None = None,
) -> Child:
    """The whole onboarding flow (plan Phase 1) in one step: every photo is
    validated and downloaded FIRST, and only then is anything written — so a
    network failure half-way can never leave a half-set-up child behind.
    Each free-text interest that matches a built-in theme also seeds that
    theme's prior (README §6), exactly as the old theme chips did."""
    from app.services import interest_service

    _validate_profile(communication_level, sensory, goals)
    _validate_goals(db, goals)
    _validate_buddy(buddy_species, buddy_name)
    if len(interests) > interest_service.MAX_INTERESTS:
        raise ValueError(f"At most {interest_service.MAX_INTERESTS} interests.")
    for item in interests:
        interest_service.validate_label(item["label"])

    downloaded = [interest_service.download_interest_image(item["image_url"]) for item in interests]

    theme_codes = []
    for item in interests:
        code = interest_service.infer_theme_code(item["label"])
        if code and code not in theme_codes:
            theme_codes.append(code)

    child = _create_child_rows(db, owner_user_id, nickname, birth_year_month, theme_codes)
    child.communication_level = communication_level
    child.sensory = sorted(set(sensory))
    child.goals = list(dict.fromkeys(goals))
    child.buddy_species = buddy_species
    child.buddy_name = buddy_name.strip().title() if buddy_name and buddy_name.strip() else None
    favourite_index = next((i for i, item in enumerate(interests) if item.get("favourite")), 0)
    for i, (item, image_path) in enumerate(zip(interests, downloaded)):
        interest_service.attach_interest(db, child, item["label"], image_path, item["source_title"], favourite=(i == favourite_index))
    db.commit()
    db.refresh(child)
    return child


def update_child_profile(db: DBSession, child_id: str, patch: dict) -> Child:
    child = db.query(Child).filter_by(id=child_id).one()
    _validate_profile(patch.get("communication_level"), patch.get("sensory"), patch.get("goals"))
    _validate_goals(db, patch.get("goals"))
    for field in ("nickname", "birth_year_month", "communication_level"):
        if patch.get(field) is not None:
            setattr(child, field, patch[field])
    if patch.get("sensory") is not None:
        child.sensory = sorted(set(patch["sensory"]))
    if patch.get("goals") is not None:
        child.goals = list(dict.fromkeys(patch["goals"]))
    _validate_buddy(patch.get("buddy_species"), patch.get("buddy_name"))
    if patch.get("buddy_species") is not None:
        child.buddy_species = patch["buddy_species"]
    if patch.get("buddy_name") is not None:
        name = patch["buddy_name"].strip()
        child.buddy_name = name.title() if name else None
    db.commit()
    db.refresh(child)
    return child


def _create_child_rows(db: DBSession, owner_user_id: str, nickname: str, birth_year_month: str, initial_interest_codes: list[str]) -> Child:
    """Child + guardianship + priors + consents, flushed but NOT committed."""
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
    db.flush()
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
    """docs/PLAN.md Phase 5: driven by the actual forgetting-curve estimate
    (RetentionModel), not a raw mastery threshold — a topic the child once
    mastered but is now at risk of forgetting belongs here even if their
    lifetime accuracy on it still looks high; a topic never attempted does
    not, even at the model's default 50% prior."""
    candidates = RetentionModel(db).due_for_revision(child_id, limit=limit)
    return [
        {"topic_id": c.topic_id, "topic_code": c.topic_code, "topic_label": c.topic_label, "retention_percent": c.retention_percent}
        for c in candidates
    ]


def interest_summary(db: DBSession, child_id: str) -> list[dict]:
    """README §2A #10: 'dynamically discovered interests' — which theme this
    child actually learns best in, discovered from randomized theme
    comparisons (docs/PLAN.md Phase 7), not just which theme they click on
    most. Parent-facing: friendly tier labels only, never raw percentages or
    posterior means — those stay on the educator dashboard (README §2A/§2B)."""
    axis = db.query(Axis).filter_by(code=THEME_AXIS_CODE).one_or_none()
    if axis is None:
        return []

    manager = ExperimentManager(db)
    estimator = EffectEstimator(db)
    scored = []
    for arm in manager.arms_for(axis.id):
        theme = db.query(Theme).filter_by(code=arm.code).one_or_none()
        if theme is None:
            continue
        scored.append((theme, estimator.posterior(child_id, axis.id, arm.id)))

    if not scored or all(post.n == 0 for _, post in scored):
        return []  # nothing tried yet — no opinion to report

    ranked = sorted(scored, key=lambda pair: pair[1].mean, reverse=True)
    out = []
    for i, (theme, post) in enumerate(ranked):
        if post.n < MIN_EVIDENCE_TRIALS:
            level = "still_discovering"
        elif i == 0:
            level = "high_interest"
        elif i == len(ranked) - 1:
            level = "still_building"
        else:
            level = "steady"
        out.append({"theme_code": theme.code, "theme_label": theme.label, "level": level})
    return out


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
    # README §19: an individualized learning-window suggestion based on
    # observed history, populated at end_session (app/services/session_service.py)
    # — None until at least one full session has finished.
    latest_engagement = (
        db.query(EngagementState)
        .filter_by(child_id=child_id)
        .filter(EngagementState.recommended_session_minutes.isnot(None))
        .order_by(EngagementState.date.desc())
        .first()
    )
    return {
        "learning_minutes_total": round(learning_minutes_total, 1),
        "activities_completed": activities_completed,
        "domains": domain_progress(db, child_id),
        "topics_to_review": topics_to_review(db, child_id),
        "interests": interest_summary(db, child_id),
        "todays_suggestions": todays_suggestions(db, child_id),
        "recent_sessions": sessions[:10],
        "recommended_session_minutes": latest_engagement.recommended_session_minutes if latest_engagement else None,
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


def link_educator(db: DBSession, child_id: str, educator_email: str) -> EducatorLink:
    """README §21/§2B: a parent grants a teacher/counsellor access to their
    child's detailed dashboard. The educator must already have an account
    with role='educator' — this is not an invitation flow, just a link."""
    educator = db.query(User).filter_by(email=educator_email, role="educator").one_or_none()
    if educator is None:
        raise ValueError("No educator account found with that email")

    existing = db.query(EducatorLink).filter_by(user_id=educator.id, child_id=child_id).one_or_none()
    if existing:
        existing.active = True
        db.commit()
        db.refresh(existing)
        return existing

    link = EducatorLink(user_id=educator.id, child_id=child_id, role="teacher", active=True)
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


def list_educators_for_child(db: DBSession, child_id: str) -> list[User]:
    links = db.query(EducatorLink).filter_by(child_id=child_id, active=True).all()
    ids = [l.user_id for l in links]
    return db.query(User).filter(User.id.in_(ids)).all() if ids else []


def update_consent(db: DBSession, child_id: str, user_id: str, scope: str, granted: bool) -> Consent:
    consent = Consent(
        child_id=child_id, scope=scope, granted=granted, granted_by=user_id, granted_at=datetime.now(timezone.utc)
    )
    db.add(consent)
    db.commit()
    db.refresh(consent)
    return consent


def withdraw_and_delete_child(db: DBSession, child_id: str) -> None:
    """docs/PLAN.md Phase 9 pilot-readiness: a parent's right to fully
    withdraw a child from the study — not just revoke consent (which stays
    in the append-only Consent log as its own record), but actually erase
    every row this child's activity created. Deletes in dependency order so
    this stays correct under a real FK-enforcing database (Postgres later,
    README's tech stack table), not just SQLite's default unenforced FKs.
    Irreversible — the API layer must get explicit confirmation before
    calling this."""
    from app.models.adults import Override
    from app.models.experiment import ArmLock, Assignment, Outcome, Verdict
    from app.models.profile_state import EngagementState, InterestState, MasteryState, ModalityState, RetentionState
    from app.models.runtime import ActivityInstance, ActivityInstanceAssignment, Interaction, InterventionEvent, ScheduledProbe
    from app.models.runtime import Session as SessionModel
    from app.models.telemetry import CrashReport
    from app.models.identity import ChildInterest
    from app.services import companion_service, interest_service

    child = db.query(Child).filter_by(id=child_id).one_or_none()
    if child is not None:
        # Stored photos aren't DB rows — erase them explicitly.
        interest_service.delete_all_interest_files(child)
        companion_service.delete_companion_file(child)
        db.query(ChildInterest).filter_by(child_id=child_id).delete(synchronize_session=False)

    session_ids = [row.id for row in db.query(SessionModel.id).filter_by(child_id=child_id).all()]
    activity_ids = (
        [row.id for row in db.query(ActivityInstance.id).filter(ActivityInstance.session_id.in_(session_ids)).all()]
        if session_ids
        else []
    )
    assignment_ids = [row.id for row in db.query(Assignment.id).filter_by(child_id=child_id).all()]

    if activity_ids:
        db.query(Interaction).filter(Interaction.activity_instance_id.in_(activity_ids)).delete(synchronize_session=False)
        db.query(ActivityInstanceAssignment).filter(ActivityInstanceAssignment.activity_instance_id.in_(activity_ids)).delete(synchronize_session=False)
    if assignment_ids:
        db.query(ActivityInstanceAssignment).filter(ActivityInstanceAssignment.assignment_id.in_(assignment_ids)).delete(synchronize_session=False)
        db.query(Outcome).filter(Outcome.assignment_id.in_(assignment_ids)).delete(synchronize_session=False)
        db.query(InterventionEvent).filter(InterventionEvent.assignment_id.in_(assignment_ids)).delete(synchronize_session=False)
    if session_ids:
        db.query(InterventionEvent).filter(InterventionEvent.session_id.in_(session_ids)).delete(synchronize_session=False)
    db.query(ScheduledProbe).filter_by(child_id=child_id).delete(synchronize_session=False)
    if activity_ids:
        db.query(ActivityInstance).filter(ActivityInstance.id.in_(activity_ids)).delete(synchronize_session=False)
    if assignment_ids:
        db.query(Assignment).filter(Assignment.id.in_(assignment_ids)).delete(synchronize_session=False)
    if session_ids:
        db.query(SessionModel).filter(SessionModel.id.in_(session_ids)).delete(synchronize_session=False)

    for model in (Verdict, ArmLock, Recommendation, Override, MasteryState, RetentionState, InterestState, ModalityState, EngagementState, Consent, CrashReport):
        db.query(model).filter_by(child_id=child_id).delete(synchronize_session=False)

    db.query(EducatorLink).filter_by(child_id=child_id).delete(synchronize_session=False)
    db.query(Guardianship).filter_by(child_id=child_id).delete(synchronize_session=False)
    db.query(Child).filter_by(id=child_id).delete(synchronize_session=False)
    db.commit()
