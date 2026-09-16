"""
Pilot-operations telemetry — NOT part of the research schema
(docs/SCHEMA.md's groups A-G): this is debugging data for keeping the app
running during the pilot (docs/PLAN.md Phase 9: "crash reporting"), not a
research contribution. Deliberately no paid crash SDK (Sentry etc.) per the
project's no-paid-API constraint — just a minimal self-hosted log.

`child_id`/`session_id` are plain nullable strings, NOT foreign keys: a
crash can happen before login, mid-navigation, or reference a session that
failed to ever get created — a crash report must never itself fail to save
because of a strict FK constraint.
"""
from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.common import TimestampMixin, UUIDPKMixin, utcnow


class CrashReport(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "crash_reports"

    platform: Mapped[str] = mapped_column(String(20))  # web | ios | android
    app_version: Mapped[str | None] = mapped_column(String(40), nullable=True)
    child_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    session_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    message: Mapped[str] = mapped_column(String(500))
    stack: Mapped[str | None] = mapped_column(Text, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
