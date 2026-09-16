"""
Group B — Curriculum & content. See docs/SCHEMA.md §3.

Every child starts from this same library (docs/ARCHITECTURE.md §6 / README §4) —
what differs per child is the *path* through it and *how* each stop is presented.
"""
from sqlalchemy import Boolean, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.common import TimestampMixin, UUIDPKMixin


class Domain(Base, UUIDPKMixin):
    __tablename__ = "domains"

    code: Mapped[str] = mapped_column(String(40), unique=True)
    label: Mapped[str] = mapped_column(String(120))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    topics: Mapped[list["Topic"]] = relationship(back_populates="domain")


class Topic(Base, UUIDPKMixin):
    __tablename__ = "topics"

    domain_id: Mapped[str] = mapped_column(String(36), ForeignKey("domains.id"))
    code: Mapped[str] = mapped_column(String(60), unique=True)  # e.g. "num_1_5"
    label: Mapped[str] = mapped_column(String(120))
    level: Mapped[str] = mapped_column(String(20))  # beginner | intermediate | advanced
    prerequisites: Mapped[list] = mapped_column(JSON, default=list)  # list[topic code]

    domain: Mapped["Domain"] = relationship(back_populates="topics")
    activity_templates: Mapped[list["ActivityTemplate"]] = relationship(back_populates="topic")
    items: Mapped[list["Item"]] = relationship(back_populates="topic")
    item_sets: Mapped[list["ItemSet"]] = relationship(back_populates="topic")


class ActivityTemplate(Base, UUIDPKMixin):
    __tablename__ = "activity_templates"

    topic_id: Mapped[str] = mapped_column(String(36), ForeignKey("topics.id"))
    modality: Mapped[str] = mapped_column(String(30))  # tap|drag_drop|match|flashcard|voice
    method_compatible: Mapped[list] = mapped_column(JSON, default=list)  # errorless|try_then_correct
    difficulty_min: Mapped[int] = mapped_column(Integer, default=1)
    difficulty_max: Mapped[int] = mapped_column(Integer, default=5)
    config: Mapped[dict] = mapped_column(JSON, default=dict)

    topic: Mapped["Topic"] = relationship(back_populates="activity_templates")


class Theme(Base, UUIDPKMixin):
    __tablename__ = "themes"

    code: Mapped[str] = mapped_column(String(40), unique=True)  # e.g. "dino"
    label: Mapped[str] = mapped_column(String(80))
    asset_path: Mapped[str] = mapped_column(String(200))

    guides: Mapped[list["Guide"]] = relationship(back_populates="theme")


class Guide(Base, UUIDPKMixin):
    __tablename__ = "guides"

    theme_id: Mapped[str] = mapped_column(String(36), ForeignKey("themes.id"))
    name: Mapped[str] = mapped_column(String(60))  # e.g. "Rex"
    character_type: Mapped[str] = mapped_column(String(40))  # living | non_living

    theme: Mapped["Theme"] = relationship(back_populates="guides")


class ItemSet(Base, UUIDPKMixin):
    """Matched groups used for fair per-child comparisons (docs/SCHEMA.md §3).

    Two sets sharing `match_group` MUST have equal size and difficulty_mean
    within +/-0.2 — enforced in app/services/curriculum_service.py, not just
    documented here, because an unmatched comparison invalidates the research
    claim (docs/ARCHITECTURE.md, ExperimentManager)."""

    __tablename__ = "item_sets"

    topic_id: Mapped[str] = mapped_column(String(36), ForeignKey("topics.id"))
    match_group: Mapped[str] = mapped_column(String(60), index=True)
    difficulty_mean: Mapped[float] = mapped_column(Float)
    size: Mapped[int] = mapped_column(Integer)

    topic: Mapped["Topic"] = relationship(back_populates="item_sets")
    items: Mapped[list["Item"]] = relationship(back_populates="item_set")


class Item(Base, UUIDPKMixin):
    __tablename__ = "items"

    topic_id: Mapped[str] = mapped_column(String(36), ForeignKey("topics.id"))
    item_set_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("item_sets.id"), nullable=True)
    difficulty: Mapped[int] = mapped_column(Integer)  # 1..5, calibrated not guessed
    answer: Mapped[dict] = mapped_column(JSON)
    distractors: Mapped[list] = mapped_column(JSON, default=list)
    theme_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("themes.id"), nullable=True)
    source: Mapped[str] = mapped_column(String(20), default="authored")  # authored | generated
    review_status: Mapped[str] = mapped_column(String(20), default="approved")  # pending|approved|rejected
    reviewed_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)

    topic: Mapped["Topic"] = relationship(back_populates="items")
    item_set: Mapped["ItemSet | None"] = relationship(back_populates="items")
