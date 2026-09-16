"""
Every test gets its own in-memory SQLite database, seeded fresh. This proves
the engine works against the real schema without touching aura_dev.db.

The env var must be set BEFORE `app.db` is imported anywhere (including by
`app.main` in test_parent_api.py) — app.config.settings and app.db.engine
are both built at import time, so setting this after the fact would have no
effect and would leave a stray backend/aura_dev.db file from test runs.
"""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
import app.models  # noqa: F401 registers all models on Base
from app.models.identity import Child, Guardianship, User


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def seeded_db(db):
    """Seeds the same curriculum content as scripts/seed.py, against the
    test's in-memory engine rather than the dev SQLite file."""
    from scripts.seed import AXES, DOMAINS, INTERVENTION_AXIS, SAFE_DEFAULT_ARMS, THEMES
    from app.models.curriculum import ActivityTemplate, Domain, Guide, Item, ItemSet, Theme, Topic
    from app.models.experiment import Arm, Axis

    domains = {}
    for code, label, order in DOMAINS:
        d = Domain(code=code, label=label, sort_order=order)
        db.add(d)
        domains[code] = d
    db.flush()

    themes = {}
    for code, label, asset_path, guide_name, char_type in THEMES:
        t = Theme(code=code, label=label, asset_path=asset_path)
        db.add(t)
        db.flush()
        db.add(Guide(theme_id=t.id, name=guide_name, character_type=char_type))
        themes[code] = t
    db.flush()

    axes = {}
    for code, label, arm_codes in [*AXES, INTERVENTION_AXIS]:
        axis = Axis(code=code, label=label, active_default=(code != INTERVENTION_AXIS[0]))
        db.add(axis)
        db.flush()
        for arm_code in arm_codes:
            db.add(
                Arm(
                    axis_id=axis.id,
                    code=arm_code,
                    label=arm_code,
                    is_safe_default=(arm_code in SAFE_DEFAULT_ARMS),
                )
            )
        axes[code] = axis
    db.flush()

    topic = Topic(domain_id=domains["numeracy"].id, code="num_1_5", label="Numbers 1-5", level="beginner", prerequisites=[])
    db.add(topic)
    db.flush()

    db.add(ActivityTemplate(topic_id=topic.id, modality="drag_drop", method_compatible=["errorless", "try_then_correct"], difficulty_min=1, difficulty_max=3, config={}))

    for theme_code in ("dino", "space"):
        item_set = ItemSet(topic_id=topic.id, match_group="num_1_5_intro_v1", difficulty_mean=1.4, size=5)
        db.add(item_set)
        db.flush()
        for answer in (1, 2, 3, 4, 5):
            db.add(
                Item(
                    topic_id=topic.id,
                    item_set_id=item_set.id,
                    difficulty=1 if answer <= 3 else 2,
                    answer={"count": answer},
                    distractors=[answer + 1] if answer < 5 else [answer - 1],
                    theme_id=themes[theme_code].id,
                )
            )
    db.commit()
    return db


@pytest.fixture()
def child_id(seeded_db):
    user = User(email="parent@example.com", password_hash="x", role="parent", display_name="Test Parent")
    seeded_db.add(user)
    seeded_db.flush()
    child = Child(nickname="Rae", birth_year_month="2020-03", created_by=user.id)
    seeded_db.add(child)
    seeded_db.flush()
    seeded_db.add(Guardianship(user_id=user.id, child_id=child.id, relation="parent"))
    seeded_db.commit()
    return child.id
