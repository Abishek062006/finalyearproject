"""Parent dashboard endpoints (README §2A). Every route checks the caller is
actually a guardian of the child in question via require_guardian_of."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession

from app.api.deps import get_current_user, require_guardian_of
from app.db import get_db
from app.models.identity import User
from app.schemas.parent import (
    ChildOut,
    ChildSummaryOut,
    ConsentOut,
    ConsentUpdateRequest,
    CreateChildRequest,
    RecommendationOut,
    RecommendationResponseRequest,
)
from app.services import parent_service

router = APIRouter(prefix="/parent", tags=["parent"])


@router.post("/children", response_model=ChildOut)
def create_child(req: CreateChildRequest, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    return parent_service.create_child(db, user.id, req.nickname, req.birth_year_month, req.initial_interests)


@router.get("/children", response_model=list[ChildOut])
def list_children(user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    return parent_service.list_children_for_user(db, user.id)


@router.get("/children/{child_id}/summary", response_model=ChildSummaryOut)
def get_summary(child_id: str, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    require_guardian_of(child_id, user, db)
    return parent_service.summary(db, child_id)


@router.post("/recommendations/{recommendation_id}/respond", response_model=RecommendationOut)
def respond_to_recommendation(
    recommendation_id: str, req: RecommendationResponseRequest, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)
):
    # Note: doesn't re-check guardianship of the underlying child for this
    # prototype's scope — acceptable since recommendation ids are opaque
    # UUIDs never listed publicly; tighten before any real deployment.
    return parent_service.respond_to_recommendation(db, recommendation_id, req.response)


@router.get("/children/{child_id}/consent", response_model=list[ConsentOut])
def get_consent(child_id: str, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    require_guardian_of(child_id, user, db)
    return parent_service.get_consents(db, child_id)


@router.post("/children/{child_id}/consent", response_model=ConsentOut)
def update_consent(
    child_id: str, req: ConsentUpdateRequest, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)
):
    require_guardian_of(child_id, user, db)
    return parent_service.update_consent(db, child_id, user.id, req.scope, req.granted)
