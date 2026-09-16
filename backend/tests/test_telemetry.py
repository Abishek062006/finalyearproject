"""Phase 9 pilot-readiness: crash reporting is deliberately unauthenticated
and must never itself fail closed."""
from tests.test_parent_api import make_client, teardown_function  # noqa: F401


def test_crash_report_can_be_submitted_without_auth(seeded_db):
    client = make_client(seeded_db)
    r = client.post(
        "/telemetry/crash-reports",
        json={"platform": "web", "app_version": "0.1.0", "message": "TypeError: x is undefined", "stack": "at ChildScreen (ChildScreen.tsx:42)"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["id"]


def test_crash_report_accepts_optional_child_and_session_context(seeded_db):
    client = make_client(seeded_db)
    r = client.post(
        "/telemetry/crash-reports",
        json={"platform": "ios", "message": "crash", "child_id": "abc-123", "session_id": "def-456"},
    )
    assert r.status_code == 200, r.text


def test_overlong_crash_message_is_truncated_not_rejected(seeded_db):
    client = make_client(seeded_db)
    r = client.post("/telemetry/crash-reports", json={"platform": "web", "message": "x" * 5000})
    assert r.status_code == 200, r.text

    from app.models.telemetry import CrashReport

    row = seeded_db.query(CrashReport).filter_by(id=r.json()["id"]).one()
    assert len(row.message) == 500
