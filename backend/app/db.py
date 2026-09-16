"""
SQLAlchemy engine + session factory.

Dev: SQLite file on disk (aura_dev.db). Swap `settings.database_url` for a Postgres
URL later — everything else (models, queries, Alembic) stays the same.
"""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """Shared declarative base for every model in app/models/."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: one DB session per request, always closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables. Fine for a research prototype; Alembic takes over
    once the schema needs versioned migrations against real data."""
    import app.models  # noqa: F401  (ensures every model is registered on Base)

    Base.metadata.create_all(bind=engine)
