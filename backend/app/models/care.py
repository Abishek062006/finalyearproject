"""
Group G — the grown-ups' side of care (plan Phase 6): a family journal,
IEP-style learning goals, and notes shared between parents and educators.
"""
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.common import UUIDPKMixin


class JournalEntry(Base, UUIDPKMixin):
    """One day in the family journal (like Birdhouse): sleep, mood, notable
    behaviour. Parents only — it is the family's own record. One entry per
    child per day; saving again edits it."""

    __tablename__ = "journal_entries"

    child_id: Mapped[str] = mapped_column(String(36), ForeignKey("children.id"), index=True)
    author_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    day: Mapped[str] = mapped_column(String(10), index=True)  # YYYY-MM-DD, the family's local date
    sleep_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    mood: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1 (very hard day) .. 5 (great day)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class LearningGoal(Base, UUIDPKMixin):
    """An IEP-style, measurable goal tied to one curriculum topic: "Leo will
    count sets of up to 5 objects with 80% accuracy in 3 sessions in a
    row". Progress is measured from the child's real answers, not ticked
    by hand, and the goal marks itself met."""

    __tablename__ = "learning_goals"

    child_id: Mapped[str] = mapped_column(String(36), ForeignKey("children.id"), index=True)
    author_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    topic_code: Mapped[str] = mapped_column(String(60))
    target_accuracy: Mapped[int] = mapped_column(Integer)  # percent
    target_sessions: Mapped[int] = mapped_column(Integer)  # consecutive sessions at or above target
    statement: Mapped[str] = mapped_column(String(240))
    status: Mapped[str] = mapped_column(String(10), default="active")  # active|met|paused
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    met_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CareNote(Base, UUIDPKMixin):
    """A short note shared between the child's grown-ups (parent ↔ teacher /
    therapist): what was tried, what happened, what to try next."""

    __tablename__ = "care_notes"

    child_id: Mapped[str] = mapped_column(String(36), ForeignKey("children.id"), index=True)
    author_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    author_name: Mapped[str] = mapped_column(String(80))
    author_role: Mapped[str] = mapped_column(String(20))  # parent|educator
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
