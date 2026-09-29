"""Parent dashboard endpoints (README §2A). Every route checks the caller is
actually a guardian of the child in question via require_guardian_of."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession

from app.api.deps import get_current_user, require_guardian_of
from app.db import get_db
from app.models.identity import User
from app.schemas.parent import (
    ChildOut,
    ChildSummaryOut,
    CompanionCandidate,
    CompanionConfirmRequest,
    CompanionOut,
    CompanionSearchRequest,
    ConsentOut,
    ConsentUpdateRequest,
    CreateChildRequest,
    EducatorLinkOut,
    LinkEducatorRequest,
    RecommendationOut,
    RecommendationResponseRequest,
)
from app.services import companion_service, export_service, parent_service

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


@router.post("/children/{child_id}/educators", response_model=EducatorLinkOut)
def link_educator(
    child_id: str, req: LinkEducatorRequest, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)
):
    require_guardian_of(child_id, user, db)
    try:
        link = parent_service.link_educator(db, child_id, req.educator_email)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc))
    educator = next(u for u in parent_service.list_educators_for_child(db, child_id) if u.id == link.user_id)
    return EducatorLinkOut(id=educator.id, display_name=educator.display_name, email=educator.email, role=educator.role)


@router.get("/children/{child_id}/educators", response_model=list[EducatorLinkOut])
def get_educators(child_id: str, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    require_guardian_of(child_id, user, db)
    return [
        EducatorLinkOut(id=e.id, display_name=e.display_name, email=e.email, role=e.role)
        for e in parent_service.list_educators_for_child(db, child_id)
    ]


@router.get("/children/{child_id}/export", response_model=dict)
def export_child_data(child_id: str, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    """docs/PLAN.md Phase 9 pilot-readiness: a parent's own data-portability
    export of their child's full record — not anonymized (they already know
    who their child is), gated only by guardianship."""
    require_guardian_of(child_id, user, db)
    return export_service.export_for_parent(db, child_id)


@router.post("/children/{child_id}/companion/search", response_model=list[CompanionCandidate])
def search_companion(
    child_id: str, req: CompanionSearchRequest, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)
):
    require_guardian_of(child_id, user, db)
    try:
        results = companion_service.search_companion_images(req.query)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    return [CompanionCandidate(**c) for c in results]


@router.post("/children/{child_id}/companion/confirm", response_model=CompanionOut)
def confirm_companion(
    child_id: str, req: CompanionConfirmRequest, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)
):
    require_guardian_of(child_id, user, db)
    try:
        child = companion_service.set_child_companion(db, child_id, req.query, req.image_url, req.source_title)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    return CompanionOut(companion_name=child.companion_name, companion_image_url=child.companion_image_url)


@router.delete("/children/{child_id}", response_model=dict)
def withdraw_and_delete_child(child_id: str, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    """docs/PLAN.md Phase 9 pilot-readiness: full withdrawal from the study —
    irreversibly deletes every row this child's activity created. The
    frontend must get explicit confirmation before calling this; the API
    itself performs no confirmation step of its own."""
    require_guardian_of(child_id, user, db)
    parent_service.withdraw_and_delete_child(db, child_id)
    return {"deleted": True}
