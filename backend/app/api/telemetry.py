"""
Crash reporting (docs/PLAN.md Phase 9 pilot-readiness). Deliberately
UNAUTHENTICATED, unlike every other route in this app — a crash can happen
before login, with an expired token, or mid-navigation with no user context
at all, and a crash reporter must never itself fail closed. No PII beyond
whatever the client optionally includes (child_id/session_id, both already
opaque UUIDs, never a name).
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession

from app.db import get_db
from app.schemas.telemetry import CrashReportOut, CrashReportRequest
from app.services import telemetry_service

router = APIRouter(prefix="/telemetry", tags=["telemetry"])


@router.post("/crash-reports", response_model=CrashReportOut)
def report_crash(req: CrashReportRequest, db: DBSession = Depends(get_db)):
    report = telemetry_service.record_crash(
        db, platform=req.platform, message=req.message, app_version=req.app_version,
        child_id=req.child_id, session_id=req.session_id, stack=req.stack,
    )
    return report
