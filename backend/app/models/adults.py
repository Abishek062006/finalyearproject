"""
Group F — Adults. See docs/SCHEMA.md §7.

Overrides are logged as data (not just applied silently) so the paper can
report how often adults disagreed with the engine — itself a finding.
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.common import UUIDPKMixin, utcnow


class Recommendation(Base, UUIDPKMixin):
    __tablename__ = "recommendations"

    child_id: Mapped[str] = mapped_column(String(36), ForeignKey("children.id"), index=True)
    kind: Mapped[str] = mapped_column(String(30))
    # revise | introduce | modality | interest | session_length
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    shown_to: Mapped[str] = mapped_column(String(20))  # parent | educator
    response: Mapped[str | None] = mapped_column(String(20), nullable=True)  # accepted|skipped
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Override(Base, UUIDPKMixin):
    __tablename__ = "overrides"

    child_id: Mapped[str] = mapped_column(String(36), ForeignKey("children.id"), index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(30))
    # assign_topic | force_arm | block_arm | adjust_difficulty
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
