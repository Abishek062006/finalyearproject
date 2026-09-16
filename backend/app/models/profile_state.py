"""
Group D — Profile state. See docs/SCHEMA.md §5.

Current beliefs, kept for fast dashboard reads. Every row here is rebuildable
from the raw `interactions` / `assignments` / `outcomes` tables — this is a
cache of the engine's state models (LearnerModel, RetentionModel, ...), not a
separate source of truth.
"""
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.common import UUIDPKMixin


class MasteryState(Base, UUIDPKMixin):
    __tablename__ = "mastery_state"

    child_id: Mapped[str] = mapped_column(String(36), ForeignKey("children.id"), index=True)
    topic_id: Mapped[str] = mapped_column(String(36), ForeignKey("topics.id"), index=True)
    p_mastery: Mapped[float] = mapped_column(Float, default=0.0)
    sd: Mapped[float] = mapped_column(Float, default=1.0)
    trials: Mapped[int] = mapped_column(Integer, default=0)
    last_practised_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class RetentionState(Base, UUIDPKMixin):
    __tablename__ = "retention_state"

    child_id: Mapped[str] = mapped_column(String(36), ForeignKey("children.id"), index=True)
    topic_id: Mapped[str] = mapped_column(String(36), ForeignKey("topics.id"), index=True)
    retention_estimate: Mapped[float] = mapped_column(Float, default=1.0)
    half_life_days: Mapped[float] = mapped_column(Float, default=7.0)
    last_probe_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revision_priority: Mapped[str] = mapped_column(String(10), default="low")  # low|medium|high


class InterestState(Base, UUIDPKMixin):
    """`parent_prior` stores the guardian's initial pick (README §5/§6) — it is
    never treated as the current value, only as a Bayesian prior that the
    randomized theme comparisons (InterestModel) update over time."""

    __tablename__ = "interest_state"

    child_id: Mapped[str] = mapped_column(String(36), ForeignKey("children.id"), index=True)
    theme_id: Mapped[str] = mapped_column(String(36), ForeignKey("themes.id"), index=True)
    effect_mean: Mapped[float] = mapped_column(Float, default=0.5)
    ci_low: Mapped[float] = mapped_column(Float, default=0.0)
    ci_high: Mapped[float] = mapped_column(Float, default=1.0)
    n_randomized_trials: Mapped[int] = mapped_column(Integer, default=0)
    parent_prior: Mapped[float | None] = mapped_column(Float, nullable=True)


class ModalityState(Base, UUIDPKMixin):
    __tablename__ = "modality_state"

    child_id: Mapped[str] = mapped_column(String(36), ForeignKey("children.id"), index=True)
    modality: Mapped[str] = mapped_column(String(30))  # tap|drag_drop|match|flashcard|voice
    effect_mean: Mapped[float] = mapped_column(Float, default=0.5)
    ci_low: Mapped[float] = mapped_column(Float, default=0.0)
    ci_high: Mapped[float] = mapped_column(Float, default=1.0)
    n_trials: Mapped[int] = mapped_column(Integer, default=0)


class EngagementState(Base, UUIDPKMixin):
    __tablename__ = "engagement_state"

    child_id: Mapped[str] = mapped_column(String(36), ForeignKey("children.id"), index=True)
    date: Mapped[str] = mapped_column(String(10))  # "2026-09-16"
    mean_engagement: Mapped[float] = mapped_column(Float, default=0.5)
    decline_after_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    distress_events: Mapped[int] = mapped_column(Integer, default=0)
    recommended_session_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
