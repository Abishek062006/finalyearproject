"""
Daily backup (docs/PLAN.md Phase 9 pilot-readiness). SQLite only, matching
the pilot's actual DB (app/config.py: no Docker, no Postgres until the
project actually moves to it — see that file's docstring).

Uses Python's built-in sqlite3.Connection.backup() — a proper ONLINE backup
(safe to run while the server is up and writing), not a raw file copy, which
could otherwise capture a half-written page if a transaction is mid-flight.

Run manually:
    backend/.venv/bin/python -m scripts.backup_db

Schedule daily via cron, e.g. (crontab -e):
    0 3 * * * cd /path/to/final-year-project/backend && .venv/bin/python -m scripts.backup_db >> backups/backup.log 2>&1

If DATABASE_URL is ever pointed at Postgres instead, this script intentionally
does nothing but say so — a `pg_dump`-based backup is a separate, later
piece of work, not implemented here since the project isn't on Postgres yet.
"""
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from app.config import settings

BACKUP_DIR = Path(__file__).resolve().parents[1] / "backups"
KEEP_LAST_N = 14  # ~2 weeks of daily backups, matching a 4-6 week pilot with margin


def _sqlite_path_from_url(url: str) -> Path | None:
    prefix = "sqlite:///"
    if not url.startswith(prefix):
        return None
    return Path(url[len(prefix) :]).resolve()


def backup() -> Path | None:
    db_path = _sqlite_path_from_url(settings.database_url)
    if db_path is None:
        print(f"DATABASE_URL is not sqlite ({settings.database_url}) — this script only backs up SQLite; use a Postgres-appropriate backup (e.g. pg_dump) instead.")
        return None
    if not db_path.exists():
        print(f"No database file at {db_path} yet — nothing to back up.")
        return None

    BACKUP_DIR.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S")
    dest_path = BACKUP_DIR / f"{db_path.stem}_{stamp}.db"

    source = sqlite3.connect(str(db_path))
    dest = sqlite3.connect(str(dest_path))
    try:
        source.backup(dest)  # online backup: safe even if the server is mid-write
    finally:
        dest.close()
        source.close()

    print(f"Backed up {db_path} -> {dest_path}")
    _prune_old_backups(db_path.stem)
    return dest_path


def _prune_old_backups(stem: str) -> None:
    backups = sorted(BACKUP_DIR.glob(f"{stem}_*.db"), key=lambda p: p.name)
    for stale in backups[:-KEEP_LAST_N]:
        stale.unlink()
        print(f"Pruned old backup: {stale.name}")


if __name__ == "__main__":
    backup()
