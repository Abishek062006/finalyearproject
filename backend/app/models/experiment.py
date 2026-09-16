"""
Group E — Experiment tables. See docs/SCHEMA.md §6.

⭐ This module is what makes the paper possible. `assignments` records not just
what was chosen but what else was allowed, why, and with what random seed —
without it there is no way to later prove the comparisons were fair or to
reconstruct what the engine believed at decision time.
"""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.common import UUIDPKMixin, utcnow


class Axis(Base, UUIDPKMixin):
    """A dimension of *how* something is taught. See README §3 for the full list."""

    __tablename__ = "axes"

    code: Mapped[str] = mapped_column(String(40), unique=True)
    # teaching_method | modality | theme | practice_structure | difficulty_band |
    # intervention | session_length
    label: Mapped[str] = mapped_column(String(120))
    active_default: Mapped[bool] = mapped_column(Boolean, default=False)

    arms: Mapped[list["Arm"]] = relationship(back_populates="axis")


class Arm(Base, UUIDPKMixin):
    """One option within an axis, e.g. axis=teaching_method -> arm=errorless."""

    __tablename__ = "arms"

    axis_id: Mapped[str] = mapped_column(String(36), ForeignKey("axes.id"))
    code: Mapped[str] = mapped_column(String(60))
    label: Mapped[str] = mapped_column(String(120))
    is_safe_default: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_review: Mapped[bool] = mapped_column(Boolean, default=False)

    axis: Mapped["Axis"] = relationship(back_populates="arms")


class Assignment(Base, UUIDPKMixin):
    """One row per decision the DecisionEngine makes. See
    docs/ARCHITECTURE.md §3 (DecisionEngine) and §5 (Data flow)."""

    __tablename__ = "assignments"

    child_id: Mapped[str] = mapped_column(String(36), ForeignKey("children.id"), index=True)
    axis_id: Mapped[str] = mapped_column(String(36), ForeignKey("axes.id"), index=True)
    arm_id: Mapped[str] = mapped_column(String(36), ForeignKey("arms.id"))
    candidate_arm_ids: Mapped[list] = mapped_column(JSON, default=list)  # what else was allowed
    decision_type: Mapped[str] = mapped_column(String(20))  # explore|exploit|locked|safe_fallback
    reason: Mapped[str] = mapped_column(String(200), default="")
    policy_version: Mapped[str] = mapped_column(String(60), default="dev")  # engine git sha
    random_seed: Mapped[int] = mapped_column(Integer, default=0)
    posterior_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)  # beliefs BEFORE deciding
    distress_level: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Outcome(Base, UUIDPKMixin):
    """A single decision, scored several ways at several points in time —
    this is what lets one teaching choice be judged both on speed now and
    memory a week later."""

    __tablename__ = "outcomes"

    assignment_id: Mapped[str] = mapped_column(String(36), ForeignKey("assignments.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    # immediate | retention_3d | retention_7d | engagement_60s | distress
    value: Mapped[float] = mapped_column(Float)
    n: Mapped[int] = mapped_column(Integer, default=1)
    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Verdict(Base, UUIDPKMixin):
    __tablename__ = "verdicts"

    child_id: Mapped[str] = mapped_column(String(36), ForeignKey("children.id"), index=True)
    axis_id: Mapped[str] = mapped_column(String(36), ForeignKey("axes.id"))
    winning_arm_id: Mapped[str] = mapped_column(String(36), ForeignKey("arms.id"))
    posterior_mean: Mapped[float] = mapped_column(Float)
    ci_low: Mapped[float] = mapped_column(Float)
    ci_high: Mapped[float] = mapped_column(Float)
    evidence_trials: Mapped[int] = mapped_column(Integer)
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    method: Mapped[str] = mapped_column(String(30))  # evidence | early_prediction
    status: Mapped[str] = mapped_column(String(20), default="provisional")
    # provisional | confirmed | reopened
    reopened_reason: Mapped[str | None] = mapped_column(String(200), nullable=True)


class ArmLock(Base, UUIDPKMixin):
    """Educator control over the action space (README §21 Human-in-the-loop)."""

    __tablename__ = "arm_locks"

    child_id: Mapped[str] = mapped_column(String(36), ForeignKey("children.id"), index=True)
    axis_id: Mapped[str] = mapped_column(String(36), ForeignKey("axes.id"))
    arm_id: Mapped[str] = mapped_column(String(36), ForeignKey("arms.id"))
    locked_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    allow: Mapped[bool] = mapped_column(Boolean)  # False = this arm may never be used
    note: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PolicyVersion(Base, UUIDPKMixin):
    __tablename__ = "policy_versions"

    git_sha: Mapped[str] = mapped_column(String(60))
    description: Mapped[str] = mapped_column(String(300), default="")
    deployed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
