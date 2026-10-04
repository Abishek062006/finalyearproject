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
os.environ["AURA_ATTENTION_RANKING"] = "0"  # tests never download photos or need the ML model file

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
    test's in-memory engine rather than the dev SQLite file — via the shared
    seed_curriculum() helper (docs/PLAN.md Phase 8), also reused by
    research/db.py so the simulation study runs against the identical
    curriculum these tests exercise."""
    from scripts.seed import seed_curriculum

    seed_curriculum(db)
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
