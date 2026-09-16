"""
Session lifecycle endpoints for the child app (docs/ARCHITECTURE.md §7).

No auth wired in yet — that arrives with the dashboards in docs/PLAN.md Phase 3.
For now a dev-only endpoint (app/api/dev.py) creates children/users to test with.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession

from app.db import get_db
from app.schemas.session import (
    ActivityOut,
    AnswerRequest,
    InteractionOut,
    SessionOut,
    StartSessionRequest,
)
from app.services import session_service

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionOut)
def start_session(req: StartSessionRequest, db: DBSession = Depends(get_db)):
    session = session_service.start_session(db, req.child_id, req.planned_minutes)
    return session


@router.get("/{session_id}/next-activity", response_model=ActivityOut)
def get_next_activity(session_id: str, db: DBSession = Depends(get_db)):
    activity = session_service.next_activity(db, session_id)
    return activity


@router.post("/activities/{activity_instance_id}/answer", response_model=InteractionOut)
def submit_answer(activity_instance_id: str, req: AnswerRequest, db: DBSession = Depends(get_db)):
    interaction = session_service.record_answer(
        db,
        activity_instance_id=activity_instance_id,
        item_id=req.item_id,
        correct=req.correct,
        response_time_ms=req.response_time_ms,
        attempts=req.attempts,
        hints_used=req.hints_used,
        interaction_id=req.interaction_id,
    )
    return interaction


@router.post("/{session_id}/end", response_model=SessionOut)
def finish_session(session_id: str, db: DBSession = Depends(get_db)):
    return session_service.end_session(db, session_id)
