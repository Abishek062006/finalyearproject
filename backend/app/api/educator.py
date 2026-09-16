"""
Educator/counsellor dashboard endpoints (README §2B). Access to a specific
child requires an active EducatorLink, granted by a parent via
POST /parent/children/{id}/educators — a guardian is not automatically
treated as an educator of their own child (deliberately different detail
levels, README §2B).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession

from app.api.deps import get_current_user, require_educator_of
from app.db import get_db
from app.models.identity import User
from app.schemas.educator import (
    AssignTopicRequest,
    ChildOut,
    EducatorChildProfile,
    LockOut,
    LockRequest,
    TopicOut,
)
from app.services import educator_service

router = APIRouter(prefix="/educator", tags=["educator"])


@router.get("/children", response_model=list[ChildOut])
def list_children(user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    return educator_service.list_children_for_educator(db, user.id)


@router.get("/children/{child_id}/profile", response_model=EducatorChildProfile)
def get_profile(child_id: str, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    require_educator_of(child_id, user, db)
    return educator_service.full_profile(db, child_id)


@router.get("/topics", response_model=list[TopicOut])
def get_topics(db: DBSession = Depends(get_db)):
    return educator_service.list_topics(db)


@router.post("/children/{child_id}/assign", response_model=dict)
def assign_topic(
    child_id: str, req: AssignTopicRequest, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)
):
    require_educator_of(child_id, user, db)
    try:
        override = educator_service.assign_topic(db, child_id, req.topic_code, user.id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc))
    return {"assigned": True, "topic_code": req.topic_code, "expires_at": override.expires_at}


@router.get("/children/{child_id}/locks", response_model=list[LockOut])
def get_locks(child_id: str, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    require_educator_of(child_id, user, db)
    return educator_service.list_locks(db, child_id)


@router.post("/children/{child_id}/locks", response_model=LockOut)
def set_lock(child_id: str, req: LockRequest, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    require_educator_of(child_id, user, db)
    try:
        educator_service.set_lock(db, child_id, req.axis_code, req.arm_code, req.allow, user.id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc))
    return LockOut(axis_code=req.axis_code, arm_code=req.arm_code, allow=req.allow)
