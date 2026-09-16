from sqlalchemy.orm import Session as DBSession

from app.models.telemetry import CrashReport


def record_crash(
    db: DBSession, platform: str, message: str, app_version: str | None = None,
    child_id: str | None = None, session_id: str | None = None, stack: str | None = None,
) -> CrashReport:
    report = CrashReport(
        platform=platform,
        app_version=app_version,
        child_id=child_id,
        session_id=session_id,
        message=message[:500],  # matches the column's String(500) — SQLite won't enforce it, Postgres later would
        stack=stack[:20_000] if stack else None,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report
