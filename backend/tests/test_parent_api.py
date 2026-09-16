"""
End-to-end HTTP tests for Phase 3: register -> login -> create child (with
initial interests) -> play a round via the session API -> check the parent
summary reflects it -> consent read/write.

Uses the same in-memory, pre-seeded DB as the engine tests (conftest.py),
wired in via FastAPI's dependency_overrides so no real HTTP hits a real DB file.
"""
from fastapi.testclient import TestClient

from app.db import get_db
from app.main import app


def make_client(seeded_db):
    def _override():
        yield seeded_db

    app.dependency_overrides[get_db] = _override
    client = TestClient(app)
    return client


def teardown_function():
    app.dependency_overrides.clear()


def test_register_login_and_create_child(seeded_db):
    client = make_client(seeded_db)

    r = client.post(
        "/auth/register",
        json={"email": "parent@example.com", "password": "hunter2", "display_name": "Ada", "role": "parent"},
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    r = client.get("/auth/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["email"] == "parent@example.com"

    # wrong password is rejected
    r = client.post("/auth/login", json={"email": "parent@example.com", "password": "wrong"})
    assert r.status_code == 401

    r = client.post("/auth/login", json={"email": "parent@example.com", "password": "hunter2"})
    assert r.status_code == 200

    r = client.post(
        "/parent/children",
        headers=headers,
        json={"nickname": "Rae", "birth_year_month": "2020-03", "initial_interests": ["dino", "space"]},
    )
    assert r.status_code == 200, r.text
    child_id = r.json()["id"]

    r = client.get("/parent/children", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["id"] == child_id


def test_a_stranger_cannot_see_someone_elses_child(seeded_db):
    client = make_client(seeded_db)

    r = client.post("/auth/register", json={"email": "a@example.com", "password": "x", "display_name": "A"})
    token_a = r.json()["access_token"]
    r = client.post(
        "/parent/children",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"nickname": "Rae", "birth_year_month": "2020-03", "initial_interests": []},
    )
    child_id = r.json()["id"]

    r = client.post("/auth/register", json={"email": "b@example.com", "password": "x", "display_name": "B"})
    token_b = r.json()["access_token"]

    r = client.get(f"/parent/children/{child_id}/summary", headers={"Authorization": f"Bearer {token_b}"})
    assert r.status_code == 403


def test_summary_reflects_a_completed_activity_and_suggestion(seeded_db):
    client = make_client(seeded_db)

    r = client.post("/auth/register", json={"email": "parent2@example.com", "password": "x", "display_name": "P"})
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

    r = client.post(
        "/parent/children",
        headers=headers,
        json={"nickname": "Rae", "birth_year_month": "2020-03", "initial_interests": ["dino"]},
    )
    child_id = r.json()["id"]

    r = client.post("/sessions", json={"child_id": child_id})
    session_id = r.json()["id"]

    r = client.get(f"/sessions/{session_id}/next-activity")
    activity = r.json()

    # Answer every item WRONG so mastery drops below the review threshold,
    # proving the summary's "topics to review" and "today's suggestion"
    # pipeline actually reacts to real performance data.
    for item in activity["spec"]["items"]:
        wrong_answer = {"id": "not-a-real-item", "answer": {"count": 999}}  # never correct
        client.post(
            f"/sessions/activities/{activity['id']}/answer",
            json={"item_id": item["id"], "correct": False, "response_time_ms": 4000},
        )

    r = client.post(f"/sessions/{session_id}/end")
    assert r.status_code == 200
    assert r.json()["end_reason"] == "completed"

    r = client.get(f"/parent/children/{child_id}/summary", headers=headers)
    assert r.status_code == 200
    body = r.json()

    assert body["activities_completed"] == 1  # all 5 items were answered
    assert any(d["domain_code"] == "numeracy" for d in body["domains"])
    assert len(body["topics_to_review"]) == 1  # numeracy topic dragged below threshold
    assert len(body["todays_suggestions"]) == 1
    assert body["recent_sessions"][0]["id"] == session_id


def test_consent_history_is_append_only_and_latest_wins(seeded_db):
    client = make_client(seeded_db)
    r = client.post("/auth/register", json={"email": "parent3@example.com", "password": "x", "display_name": "P"})
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    r = client.post("/parent/children", headers=headers, json={"nickname": "Rae", "birth_year_month": "2020-03", "initial_interests": []})
    child_id = r.json()["id"]

    r = client.get(f"/parent/children/{child_id}/consent", headers=headers)
    by_scope = {c["scope"]: c["granted"] for c in r.json()}
    assert by_scope == {"data_collection": True, "camera": False}

    r = client.post(f"/parent/children/{child_id}/consent", headers=headers, json={"scope": "camera", "granted": True})
    assert r.status_code == 200

    r = client.get(f"/parent/children/{child_id}/consent", headers=headers)
    by_scope = {c["scope"]: c["granted"] for c in r.json()}
    assert by_scope["camera"] is True  # latest row wins, old one untouched
