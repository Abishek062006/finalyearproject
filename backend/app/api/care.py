"""
The grown-ups' care features (plan Phase 6), shared by a child's parents
and linked educators: progress over time, goals and notes. The family
journal is parents-only.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session as DBSession

from app.api.deps import get_current_user, require_educator_of, require_guardian_of
from app.db import get_db
from app.models.curriculum import Domain, Topic
from app.models.identity import User
from app.schemas.care import GoalIn, GoalStatusIn, JournalIn, JournalOut, NoteIn, NoteOut
from app.services import care_service, progress_service

router = APIRouter(prefix="/care/children/{child_id}", tags=["care"])


def require_grown_up_of(child_id: str, user: User, db: DBSession) -> None:
    """A guardian, or an educator the family has linked."""
    try:
        require_guardian_of(child_id, user, db)
    except HTTPException:
        require_educator_of(child_id, user, db)


def _is_guardian(child_id: str, user: User, db: DBSession) -> bool:
    try:
        require_guardian_of(child_id, user, db)
        return True
    except HTTPException:
        return False


@router.get("/progress")
def progress(child_id: str, days: int = Query(14, ge=7, le=90), user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    require_grown_up_of(child_id, user, db)
    is_parent = _is_guardian(child_id, user, db)
    return {
        "daily": progress_service.daily(db, child_id, days),
        "sessions": progress_service.session_history(db, child_id),
        "what_works": progress_service.what_works(db, child_id),
        "goals": care_service.list_goals(db, child_id),
        # built from the family journal, so only the family sees it
        "sleep_insight": progress_service.sleep_insight(db, child_id) if is_parent else None,
    }


@router.get("/journal", response_model=list[JournalOut])
def get_journal(child_id: str, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    require_guardian_of(child_id, user, db)
    return care_service.list_journal(db, child_id)


@router.put("/journal", response_model=JournalOut)
def save_journal(child_id: str, req: JournalIn, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    require_guardian_of(child_id, user, db)
    try:
        return care_service.save_journal_entry(db, child_id, user.id, req.day, req.sleep_hours, req.mood, req.tags, req.note)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))


@router.delete("/journal/{entry_id}")
def delete_journal(child_id: str, entry_id: str, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    require_guardian_of(child_id, user, db)
    try:
        care_service.delete_journal_entry(db, child_id, entry_id)
    except LookupError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    return {"deleted": entry_id}


@router.get("/goals")
def get_goals(child_id: str, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    require_grown_up_of(child_id, user, db)
    return care_service.list_goals(db, child_id)


@router.post("/goals")
def add_goal(child_id: str, req: GoalIn, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    require_grown_up_of(child_id, user, db)
    try:
        goal = care_service.create_goal(db, child_id, user.id, req.topic_code, req.target_accuracy, req.target_sessions, req.statement)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    return care_service.goal_progress(db, goal)


@router.patch("/goals/{goal_id}")
def update_goal(child_id: str, goal_id: str, req: GoalStatusIn, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    require_grown_up_of(child_id, user, db)
    try:
        return care_service.set_goal_status(db, child_id, goal_id, req.status)
    except LookupError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))


@router.get("/notes", response_model=list[NoteOut])
def get_notes(child_id: str, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    require_grown_up_of(child_id, user, db)
    return [NoteOut.of(n) for n in care_service.list_notes(db, child_id)]


@router.post("/notes", response_model=NoteOut)
def post_note(child_id: str, req: NoteIn, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    require_grown_up_of(child_id, user, db)
    try:
        return NoteOut.of(care_service.add_note(db, child_id, user, req.text))
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))


@router.get("/topics")
def topics(child_id: str, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    """What a goal can be about: every curriculum topic, grouped by area."""
    require_grown_up_of(child_id, user, db)
    domains = {d.id: d.label for d in db.query(Domain).all()}
    return [{"code": t.code, "label": t.label, "domain": domains.get(t.domain_id, "")} for t in db.query(Topic).order_by(Topic.label).all()]
