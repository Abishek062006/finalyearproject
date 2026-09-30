"""
Phase 9 pilot-readiness: a parent's own data export (data portability), the
gated anonymized research export, and full withdrawal/deletion.
"""
from app.db import get_db
from app.main import app
from app.models.identity import Child, Consent, Guardianship
from app.models.runtime import Interaction, Session as SessionModel
from tests.test_parent_api import make_client, teardown_function  # noqa: F401


def _register_and_create_child(client, email="parent9@example.com"):
    r = client.post("/auth/register", json={"email": email, "password": "x", "display_name": "P", "role": "parent"})
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    r = client.post("/parent/children", headers=headers, json={"nickname": "Rae", "birth_year_month": "2020-03", "initial_interests": []})
    return headers, r.json()["id"]


def _play_one_round(client, headers, child_id):
    r = client.post("/sessions", json={"child_id": child_id})
    session_id = r.json()["id"]
    activity = client.get(f"/sessions/{session_id}/next-activity").json()
    item = activity["spec"]["items"][0]
    client.post(f"/sessions/activities/{activity['id']}/answer", json={"item_id": item["id"], "correct": True, "response_time_ms": 1000})
    return session_id


def test_parent_export_returns_full_unanonymized_data(seeded_db):
    client = make_client(seeded_db)
    headers, child_id = _register_and_create_child(client)
    _play_one_round(client, headers, child_id)

    r = client.get(f"/parent/children/{child_id}/export", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["nickname"] == "Rae"
    assert body["child_id"] == child_id
    assert len(body["sessions"]) == 1
    assert len(body["activity_instances"]) >= 1
    assert len(body["interactions"]) >= 1


def test_parent_cannot_export_a_child_they_dont_guard(seeded_db):
    client = make_client(seeded_db)
    _headers_a, child_id = _register_and_create_child(client, "parentA@example.com")
    headers_b, _ = _register_and_create_child(client, "parentB@example.com")

    r = client.get(f"/parent/children/{child_id}/export", headers=headers_b)
    assert r.status_code == 403


def test_educator_export_requires_research_use_consent(seeded_db):
    client = make_client(seeded_db)
    parent_headers, child_id = _register_and_create_child(client)
    _play_one_round(client, parent_headers, child_id)

    r = client.post("/auth/register", json={"email": "teacher9@example.com", "password": "x", "display_name": "T", "role": "educator"})
    teacher_headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    client.post(f"/parent/children/{child_id}/educators", headers=parent_headers, json={"educator_email": "teacher9@example.com"})

    r = client.get(f"/educator/children/{child_id}/export", headers=teacher_headers)
    assert r.status_code == 403, "no research_use consent granted yet"

    r = client.post(f"/parent/children/{child_id}/consent", headers=parent_headers, json={"scope": "research_use", "granted": True})
    assert r.status_code == 200, r.text

    r = client.get(f"/educator/children/{child_id}/export", headers=teacher_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "child_id" not in body
    assert "nickname" not in body
    assert body["child_hash"]
    assert all(s["child_id"] == body["child_hash"] for s in body["sessions"])


def test_withdrawing_consent_after_granting_it_blocks_export_again(seeded_db):
    client = make_client(seeded_db)
    parent_headers, child_id = _register_and_create_child(client)
    r = client.post("/auth/register", json={"email": "teacher10@example.com", "password": "x", "display_name": "T", "role": "educator"})
    teacher_headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    client.post(f"/parent/children/{child_id}/educators", headers=parent_headers, json={"educator_email": "teacher10@example.com"})

    client.post(f"/parent/children/{child_id}/consent", headers=parent_headers, json={"scope": "research_use", "granted": True})
    assert client.get(f"/educator/children/{child_id}/export", headers=teacher_headers).status_code == 200

    client.post(f"/parent/children/{child_id}/consent", headers=parent_headers, json={"scope": "research_use", "granted": False})
    assert client.get(f"/educator/children/{child_id}/export", headers=teacher_headers).status_code == 403


def test_withdraw_and_delete_removes_every_row(seeded_db):
    client = make_client(seeded_db)
    headers, child_id = _register_and_create_child(client)
    session_id = _play_one_round(client, headers, child_id)
    client.post(f"/parent/children/{child_id}/consent", headers=headers, json={"scope": "research_use", "granted": True})
    # Phase 4/6 records about the child must go too.
    client.post("/sessions/signals", json={"child_id": child_id, "session_id": session_id, "kind": "break"})
    client.put(f"/care/children/{child_id}/journal", headers=headers, json={"day": "2026-09-30", "sleep_hours": 9})
    client.post(f"/care/children/{child_id}/goals", headers=headers, json={"topic_code": "num_1_5"})
    client.post(f"/care/children/{child_id}/notes", headers=headers, json={"text": "note"})

    r = client.delete(f"/parent/children/{child_id}", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json() == {"deleted": True}

    assert seeded_db.query(Child).filter_by(id=child_id).one_or_none() is None
    assert seeded_db.query(Guardianship).filter_by(child_id=child_id).count() == 0
    assert seeded_db.query(Consent).filter_by(child_id=child_id).count() == 0
    assert seeded_db.query(SessionModel).filter_by(id=session_id).one_or_none() is None
    assert seeded_db.query(Interaction).count() == 0
    from app.models.care import CareNote, JournalEntry, LearningGoal
    from app.models.runtime import ChildSignal

    for model in (ChildSignal, JournalEntry, LearningGoal, CareNote):
        assert seeded_db.query(model).filter_by(child_id=child_id).count() == 0, model.__name__

    r = client.get("/parent/children", headers=headers)
    assert r.json() == []


def test_withdraw_and_delete_requires_guardianship(seeded_db):
    client = make_client(seeded_db)
    _headers_a, child_id = _register_and_create_child(client, "parentC@example.com")
    headers_b, _ = _register_and_create_child(client, "parentD@example.com")

    r = client.delete(f"/parent/children/{child_id}", headers=headers_b)
    assert r.status_code == 403
    assert seeded_db.query(Child).filter_by(id=child_id).one_or_none() is not None
