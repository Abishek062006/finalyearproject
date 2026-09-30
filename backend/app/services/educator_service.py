"""
Educator/counsellor dashboard business logic (README §2B). Deliberately more
detailed than the parent view — raw per-arm evidence, explicitly labelled as
internal model estimates (README §2B: "These scores are internal model
estimates and should be clearly labelled as such").
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session as DBSession

from app.engine.decision_engine import INTERVENTION_AXIS_CODE
from app.engine.effect_estimator import EffectEstimator
from app.engine.experiment_manager import ExperimentManager
from app.models.adults import Override
from app.models.curriculum import Topic
from app.models.experiment import Arm, ArmLock, Axis
from app.models.identity import Child, EducatorLink
from app.services.parent_service import domain_progress

ASSIGNMENT_WINDOW_HOURS = 24  # how long an educator's topic assignment holds

# The intervention axis is judged on whether engagement recovered, not on
# correctness — it's not in ExperimentManager.ACTIVE_AXIS_CODES (it's only
# triggered conditionally, docs/PLAN.md Phase 6), so it needs to be added
# here explicitly rather than falling out of active_axes().
AXIS_OUTCOME_KIND = {INTERVENTION_AXIS_CODE: "engagement_60s"}


def list_children_for_educator(db: DBSession, user_id: str) -> list[Child]:
    return (
        db.query(Child)
        .join(EducatorLink, EducatorLink.child_id == Child.id)
        .filter(EducatorLink.user_id == user_id, EducatorLink.active.is_(True))
        .all()
    )


def axis_evidence(db: DBSession, child_id: str) -> list[dict]:
    manager = ExperimentManager(db)
    estimator = EffectEstimator(db)
    intervention_axis = db.query(Axis).filter_by(code=INTERVENTION_AXIS_CODE).one_or_none()
    axes = manager.active_axes() + ([intervention_axis] if intervention_axis else [])

    out = []
    for axis in axes:
        kind = AXIS_OUTCOME_KIND.get(axis.code, "immediate")
        arms = manager.arms_for(axis.id)
        arm_ids = [a.id for a in arms]
        winner = estimator.winner(child_id, axis.id, arm_ids, kind=kind)
        arm_rows = []
        for arm in arms:
            post = estimator.posterior(child_id, axis.id, arm.id, kind=kind)
            arm_rows.append(
                {
                    "arm_code": arm.code,
                    "label": arm.label,
                    "trials": post.n,
                    "accuracy_percent": round(post.mean * 100),  # for "intervention", this reads as an engagement-recovery score
                    "ci_low_percent": round(post.ci_low * 100),  # 95% credible interval of that estimate
                    "ci_high_percent": round(post.ci_high * 100),
                    "is_current_winner": winner is not None and winner.arm_id == arm.id,
                }
            )
        out.append(
            {
                "axis_code": axis.code,
                "axis_label": axis.label,
                "arms": arm_rows,
                "winner_confidence": round(winner.mean * 100) if winner else None,
                "evidence_trials": winner.evidence_trials if winner else sum(a["trials"] for a in arm_rows),
            }
        )
    return out


def full_profile(db: DBSession, child_id: str) -> dict:
    child = db.query(Child).filter_by(id=child_id).one()
    return {
        "child_id": child.id,
        "nickname": child.nickname,
        "domains": domain_progress(db, child_id),
        "axes": axis_evidence(db, child_id),
    }


def list_topics(db: DBSession) -> list[Topic]:
    return db.query(Topic).all()


def assign_topic(db: DBSession, child_id: str, topic_code: str, user_id: str) -> Override:
    topic = db.query(Topic).filter_by(code=topic_code).one_or_none()
    if topic is None:
        raise ValueError(f"Unknown topic code: {topic_code}")
    override = Override(
        child_id=child_id,
        user_id=user_id,
        kind="assign_topic",
        payload={"topic_id": topic.id, "topic_code": topic.code},
        expires_at=datetime.now(timezone.utc) + timedelta(hours=ASSIGNMENT_WINDOW_HOURS),
    )
    db.add(override)
    db.commit()
    db.refresh(override)
    return override


def list_locks(db: DBSession, child_id: str) -> list[dict]:
    """Latest lock per (axis, arm) — like consent, locks are append-only
    events (docs/SCHEMA.md §6: arm_locks), so the current state is whichever
    row for that pair was written most recently."""
    rows = db.query(ArmLock).filter_by(child_id=child_id).order_by(ArmLock.created_at.desc()).all()
    latest: dict[tuple[str, str], ArmLock] = {}
    for row in rows:
        key = (row.axis_id, row.arm_id)
        latest.setdefault(key, row)

    out = []
    for (axis_id, arm_id), lock in latest.items():
        axis = db.query(Axis).filter_by(id=axis_id).one()
        arm = db.query(Arm).filter_by(id=arm_id).one()
        out.append({"axis_code": axis.code, "arm_code": arm.code, "allow": lock.allow})
    return out


def set_lock(db: DBSession, child_id: str, axis_code: str, arm_code: str, allow: bool, user_id: str) -> ArmLock:
    axis = db.query(Axis).filter_by(code=axis_code).one_or_none()
    if axis is None:
        raise ValueError(f"Unknown axis code: {axis_code}")
    arm = db.query(Arm).filter_by(axis_id=axis.id, code=arm_code).one_or_none()
    if arm is None:
        raise ValueError(f"Unknown arm code: {arm_code} for axis {axis_code}")

    lock = ArmLock(child_id=child_id, axis_id=axis.id, arm_id=arm.id, locked_by=user_id, allow=allow)
    db.add(lock)
    db.commit()
    db.refresh(lock)
    return lock
