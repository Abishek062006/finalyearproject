"""
Dev-only convenience endpoints: create a parent user + child without a real
auth flow yet. Real auth (JWT, roles) lands with the dashboards in
docs/PLAN.md Phase 3. Remove or lock this router down before any real deployment.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession

from app.db import get_db
from app.models.identity import Child, Guardianship, User
from app.models.common import new_uuid
from app.schemas.session import ChildOut, CreateChildRequest

router = APIRouter(prefix="/dev", tags=["dev"])


@router.post("/quickstart", response_model=ChildOut)
def quickstart(db: DBSession = Depends(get_db)):
    """Creates one parent user + one child in a single call, so the Expo app
    (or curl) has something to point at immediately."""
    user = User(email=f"parent+{new_uuid()[:8]}@example.com", password_hash="dev", role="parent", display_name="Dev Parent")
    db.add(user)
    db.flush()

    child = Child(nickname="Rae", birth_year_month="2020-03", created_by=user.id)
    db.add(child)
    db.flush()

    db.add(Guardianship(user_id=user.id, child_id=child.id, relation="parent"))
    db.commit()
    db.refresh(child)
    return child


@router.post("/children", response_model=ChildOut)
def create_child(req: CreateChildRequest, db: DBSession = Depends(get_db)):
    child = Child(nickname=req.nickname, birth_year_month=req.birth_year_month, created_by=req.created_by_user_id)
    db.add(child)
    db.commit()
    db.refresh(child)
    return child
