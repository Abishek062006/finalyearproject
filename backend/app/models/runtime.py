"""
Group C — Runtime. See docs/SCHEMA.md §4.

`interactions` is the highest-volume table: one row per meaningful touch or
response. `activity_instances.spec` stores the exact ActivitySpec sent to the
device (docs/ARCHITECTURE.md §6), so any past session can be replayed exactly
even after the engine changes.
"""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.common import TimestampMixin, UUIDPKMixin, new_uuid


class Session(Base, UUIDPKMixin):
    __tablename__ = "sessions"

    child_id: Mapped[str] = mapped_column(String(36), ForeignKey("children.id"), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    planned_minutes: Mapped[float | None] = mapped_column(nullable=True)
    actual_minutes: Mapped[float | None] = mapped_column(nullable=True)
    device: Mapped[str | None] = mapped_column(String(80), nullable=True)
    app_version: Mapped[str | None] = mapped_column(String(40), nullable=True)
    end_reason: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # completed | child_stopped | adult_stopped | distress | timeout

    activity_instances: Mapped[list["ActivityInstance"]] = relationship(back_populates="session")


class ActivityInstance(Base, UUIDPKMixin):
    __tablename__ = "activity_instances"

    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("sessions.id"), index=True)
    topic_id: Mapped[str] = mapped_column(String(36), ForeignKey("topics.id"))
    assignment_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("assignments.id"), nullable=True
    )  # links this activity back to the decision that produced it (ExperimentManager)
    item_set_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("item_sets.id"), nullable=True)
    spec: Mapped[dict] = mapped_column(JSON)  # the exact ActivitySpec sent to the device
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    abandoned: Mapped[bool] = mapped_column(Boolean, default=False)

    session: Mapped["Session"] = relationship(back_populates="activity_instances")
    interactions: Mapped[list["Interaction"]] = relationship(back_populates="activity_instance")


class ActivityInstanceAssignment(Base, UUIDPKMixin):
    """Links one activity to every assignment that shaped it. Up to 2 rows per
    activity in this prototype (docs/PLAN.md Phase 4: "at most 2 axes active
    at a time") — one per active axis (e.g. teaching_method + modality).
    An outcome recorded for the activity is attributed to every linked
    assignment, since each axis's arm genuinely contributed to that result.
    """

    __tablename__ = "activity_instance_assignments"

    activity_instance_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("activity_instances.id"), index=True
    )
    assignment_id: Mapped[str] = mapped_column(String(36), ForeignKey("assignments.id"), index=True)


class Interaction(Base, UUIDPKMixin):
    """id is client-generated (UUID) so re-uploads after a dropped connection
    are idempotent — see docs/ARCHITECTURE.md §8 (Offline and reliability)."""

    __tablename__ = "interactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    activity_instance_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("activity_instances.id"), index=True
    )
    item_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("items.id"), nullable=True)
    kind: Mapped[str] = mapped_column(String(20))  # answer|tap|drag|hint_request|idle|abandon
    correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    response_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    first_touch_latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=1)
    hints_used: Mapped[int] = mapped_column(Integer, default=0)
    off_target_taps: Mapped[int] = mapped_column(Integer, default=0)
    device_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    server_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)

    activity_instance: Mapped["ActivityInstance"] = relationship(back_populates="interactions")


class ScheduledProbe(Base, UUIDPKMixin):
    """The delayed-outcome mechanism (docs/ARCHITECTURE.md §5). `source_assignment_id`
    is what lets a result days later be attributed back to the teaching method
    that produced the original learning."""

    __tablename__ = "scheduled_probes"

    child_id: Mapped[str] = mapped_column(String(36), ForeignKey("children.id"), index=True)
    topic_id: Mapped[str] = mapped_column(String(36), ForeignKey("topics.id"))
    item_set_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("item_sets.id"), nullable=True)
    source_assignment_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("assignments.id"), nullable=True
    )
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    delay_days: Mapped[int] = mapped_column(Integer)  # 3 | 7 | audit(=0)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|delivered|missed
    delivered_activity_instance_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("activity_instances.id"), nullable=True
    )


class InterventionEvent(Base, UUIDPKMixin):
    __tablename__ = "intervention_events"

    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("sessions.id"), index=True)
    triggered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    engagement_before: Mapped[float] = mapped_column()
    intervention_arm_id: Mapped[str] = mapped_column(String(36), ForeignKey("arms.id"))
    duration_s: Mapped[int] = mapped_column(Integer)
    engagement_after_60s: Mapped[float | None] = mapped_column(nullable=True)
    assignment_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("assignments.id"), nullable=True
    )
