"""
A throwaway, in-memory database per simulated child — mirrors
backend/tests/conftest.py's `db` + `seeded_db` fixtures exactly (both call
the same scripts.seed.seed_curriculum, docs/PLAN.md Phase 8), just callable
as a plain function instead of a pytest fixture.
"""
import uuid

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import research  # noqa: F401 — runs the sys.path bootstrap before the app.* imports below

from app.db import Base
import app.models  # noqa: F401 registers every model on Base
from app.models.curriculum import Topic
from app.models.identity import Child, Guardianship, User
from scripts.seed import seed_curriculum

TOPIC_CODE = "num_1_5"


def build_db() -> Session:
    """A fresh in-memory SQLite database, fully seeded with the same
    curriculum the app and tests use."""
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    db = SessionLocal()
    seed_curriculum(db)
    db.commit()
    return db


def register_child(db: Session, nickname: str = "Sim") -> str:
    unique = uuid.uuid4().hex[:8]
    user = User(email=f"{unique}@sim.local", password_hash="x", role="parent", display_name="Simulated Parent")
    db.add(user)
    db.flush()
    child = Child(nickname=nickname, birth_year_month="2020-01", created_by=user.id)
    db.add(child)
    db.flush()
    db.add(Guardianship(user_id=user.id, child_id=child.id, relation="parent"))
    db.commit()
    return child.id


def topic_id(db: Session) -> str:
    return db.query(Topic).filter_by(code=TOPIC_CODE).one().id
