"""
Central settings. Reads from environment variables / a .env file.

SQLite for now (see docs/PLAN.md Phase 0 — no Docker, no deployment yet).
Switching to Postgres later is a one-line change to DATABASE_URL.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "AURA"
    database_url: str = "sqlite:///./aura_dev.db"
    secret_key: str = "dev-only-secret-change-me"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days, fine for a research prototype
    cors_origins: list[str] = ["*"]  # tighten before any real deployment


settings = Settings()
