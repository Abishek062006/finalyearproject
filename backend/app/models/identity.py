"""
Group A — Identity & consent. See docs/SCHEMA.md §2.

Deliberately minimal personal data: nickname + age band for children, no legal
names, no addresses. `research_hash` is what leaves the building in any export.
"""
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.common import TimestampMixin, UUIDPKMixin, new_uuid


DEFAULT_BUDDY_NAME = "Pip"


class User(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20))  # parent | educator | admin
    display_name: Mapped[str] = mapped_column(String(120))


class Child(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "children"

    nickname: Mapped[str] = mapped_column(String(80))
    birth_year_month: Mapped[str] = mapped_column(String(7))  # "2019-04" — age band only
    research_hash: Mapped[str] = mapped_column(String(64), unique=True, default=new_uuid)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))

    # A parent-chosen companion (docs/PLAN.md UX-overhaul Phase C): a real,
    # licensed photo the parent picked for whatever their child is actually
    # into, shown as the guide character across activities — independent of
    # the 4 built-in themes, which stay fixed so the existing randomized
    # theme-preference experiment (docs/ARCHITECTURE.md) is never touched by
    # this. Nullable: most of this prototype's test children have none.
    companion_name: Mapped[str | None] = mapped_column(String(60), nullable=True)
    companion_image_path: Mapped[str | None] = mapped_column(String(200), nullable=True)  # served via /media
    companion_source_title: Mapped[str | None] = mapped_column(String(200), nullable=True)  # provenance, e.g. Commons file title

    # Onboarding profile (plan Phase 1). All nullable/empty by default so
    # children created before onboarding existed — and every test/research
    # fixture — behave exactly as they did.
    communication_level: Mapped[str | None] = mapped_column(String(20), nullable=True)  # sentences|words|gestures|non_speaking
    sensory: Mapped[list] = mapped_column(JSON, default=list)  # subset of sounds|lights|motion|timers
    goals: Mapped[list] = mapped_column(JSON, default=list)  # curriculum Domain codes the parent wants to focus on
    # The on-screen friend's name (plan Phase 2). One constant character per
    # child across every theme and session — predictability matters more to
    # autistic children than variety. Null means the default, "Pip".
    buddy_name: Mapped[str | None] = mapped_column(String(20), nullable=True)

    guardianships: Mapped[list["Guardianship"]] = relationship(back_populates="child")
    educator_links: Mapped[list["EducatorLink"]] = relationship(back_populates="child")
    consents: Mapped[list["Consent"]] = relationship(back_populates="child")
    interests: Mapped[list["ChildInterest"]] = relationship(back_populates="child", order_by="ChildInterest.created_at")

    @property
    def buddy(self) -> str:
        return self.buddy_name or DEFAULT_BUDDY_NAME

    @property
    def companion_image_url(self) -> str | None:
        """The served URL for `companion_image_path` — computed rather than
        stored, so ChildOut (pydantic from_attributes) can read it directly
        without every caller re-deriving the /media prefix."""
        return f"/media/{self.companion_image_path}" if self.companion_image_path else None


class ChildInterest(Base, UUIDPKMixin, TimestampMixin):
    """Something the child loves, with a parent-approved real photo (plan
    Phase 1, generalizing Phase C's single companion). Exactly one may be the
    favourite — that one is mirrored into Child.companion_* and becomes the
    guide. Photos live under media/interests/, never re-fetched live."""

    __tablename__ = "child_interests"

    child_id: Mapped[str] = mapped_column(String(36), ForeignKey("children.id"), index=True)
    label: Mapped[str] = mapped_column(String(60))
    image_path: Mapped[str] = mapped_column(String(200))  # relative to media/
    source_title: Mapped[str] = mapped_column(String(200))
    is_favourite: Mapped[bool] = mapped_column(Boolean, default=False)

    child: Mapped["Child"] = relationship(back_populates="interests")

    @property
    def image_url(self) -> str:
        return f"/media/{self.image_path}"


class Guardianship(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "guardianships"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    child_id: Mapped[str] = mapped_column(String(36), ForeignKey("children.id"))
    relation: Mapped[str] = mapped_column(String(40), default="parent")

    child: Mapped["Child"] = relationship(back_populates="guardianships")


class EducatorLink(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "educator_links"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    child_id: Mapped[str] = mapped_column(String(36), ForeignKey("children.id"))
    role: Mapped[str] = mapped_column(String(40), default="teacher")  # teacher | counsellor
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    child: Mapped["Child"] = relationship(back_populates="educator_links")


class Consent(Base, UUIDPKMixin):
    """Full history, never overwritten. Every export / camera read checks the
    latest row for its scope before doing anything."""

    __tablename__ = "consents"

    child_id: Mapped[str] = mapped_column(String(36), ForeignKey("children.id"))
    scope: Mapped[str] = mapped_column(String(40))  # data_collection | camera | research_use
    granted: Mapped[bool] = mapped_column(Boolean)
    granted_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    child: Mapped["Child"] = relationship(back_populates="consents")
