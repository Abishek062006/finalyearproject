"""
Session lifecycle endpoints for the child app (docs/ARCHITECTURE.md §7).

No auth wired in yet — that arrives with the dashboards in docs/PLAN.md Phase 3.
For now a dev-only endpoint (app/api/dev.py) creates children/users to test with.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from app.db import get_db
from app.schemas.session import (
    ActivityOut,
    AnswerRequest,
    EndSessionRequest,
    InteractionOut,
    SessionOut,
    SignalOut,
    SignalRequest,
    StartSessionRequest,
)
from app.services import session_service, signal_service

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
    try:
        return session_service.record_answer(
            db,
            activity_instance_id=activity_instance_id,
            item_id=req.item_id,
            correct=req.correct,
            response_time_ms=req.response_time_ms,
            attempts=req.attempts,
            hints_used=req.hints_used,
            interaction_id=req.interaction_id,
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{session_id}/end", response_model=SessionOut)
def finish_session(session_id: str, req: EndSessionRequest | None = None, db: DBSession = Depends(get_db)):
    reason = req.end_reason if req else "completed"
    if reason not in ("completed", "child_all_done", "grown_up"):
        raise HTTPException(status_code=400, detail="unknown end reason")
    return session_service.end_session(db, session_id, end_reason=reason)


@router.post("/signals", response_model=SignalOut)
def send_signal(req: SignalRequest, db: DBSession = Depends(get_db)):
    """Break / Help / All done / feelings / Talk board (plan Phase 4)."""
    try:
        return signal_service.record_signal(db, req.child_id, req.kind, req.value, session_id=req.session_id)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
