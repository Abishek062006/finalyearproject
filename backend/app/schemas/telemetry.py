"""Crash reporting (docs/PLAN.md Phase 9 pilot-readiness). No paid crash SDK
— a minimal self-hosted log the pilot's tech contact can read directly."""
from datetime import datetime

from pydantic import BaseModel


class CrashReportRequest(BaseModel):
    platform: str  # web | ios | android
    app_version: str | None = None
    child_id: str | None = None
    session_id: str | None = None
    message: str
    stack: str | None = None


class CrashReportOut(BaseModel):
    id: str
    occurred_at: datetime

    model_config = {"from_attributes": True}
