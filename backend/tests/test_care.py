"""Plan Phase 6: progress over time, the family journal, IEP-style goals
that measure themselves, and shared notes — with the right people able to
see each."""
import pytest
from fastapi.testclient import TestClient

from app.db import get_db
from app.main import app
from app.services import educator_service, session_service


@pytest.fixture()
def client(seeded_db):
    def _override():
        yield seeded_db

    app.dependency_overrides[get_db] = _override
    yield TestClient(app)
    app.dependency_overrides.clear()


def _headers(client, email, role="parent", name="P"):
    r = client.post("/auth/register", json={"email": email, "password": "x", "display_name": name, "role": role})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture()
def family(client):
    parent = _headers(client, "mum@example.com", name="Mum")
    child = client.post("/parent/children", headers=parent, json={"nickname": "Sam", "birth_year_month": "2019-05"}).json()["id"]
    teacher = _headers(client, "teacher@example.com", role="educator", name="Ms Lee")
    client.post(f"/parent/children/{child}/educators", headers=parent, json={"educator_email": "teacher@example.com"})
    stranger = _headers(client, "stranger@example.com")
    return {"parent": parent, "teacher": teacher, "stranger": stranger, "child": child}


def _practise(db, child_id, topic, correct_per_session: list[bool]):
    """One session per entry, answering every item of one activity."""
    educator_service.assign_topic(db, child_id, topic, user_id="t")
    for correct in correct_per_session:
        session = session_service.start_session(db, child_id)
        activity = session_service.next_activity(db, session.id)
        for item in activity.spec["items"]:
            session_service.record_answer(db, activity.id, item_id=item["id"], correct=correct, response_time_ms=1500)
        session_service.end_session(db, session.id)


def test_progress_has_a_row_for_every_day_and_real_sessions(client, family, seeded_db):
    _practise(seeded_db, family["child"], "num_1_5", [True])
    r = client.get(f"/care/children/{family['child']}/progress?days=7", headers=family["parent"])
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["daily"]) == 7
    assert body["daily"][-1]["answers"] > 0 and body["daily"][-1]["accuracy_percent"] == 100
    assert body["sessions"][0]["accuracy_percent"] == 100
    assert {w["axis_code"] for w in body["what_works"]} >= {"teaching_method", "modality", "theme"}
    assert all(not w["confirmed"] for w in body["what_works"])  # one session is never enough to call a winner


def test_a_goal_measures_itself_and_marks_itself_met(client, family, seeded_db):
    r = client.post(
        f"/care/children/{family['child']}/goals",
        headers=family["teacher"],
        json={"topic_code": "num_1_5", "target_accuracy": 80, "target_sessions": 2},
    )
    assert r.status_code == 200, r.text
    goal = r.json()
    assert goal["status"] == "active" and goal["sessions_in_a_row"] == 0
    assert "Sam will" in goal["statement"]

    _practise(seeded_db, family["child"], "num_1_5", [False, True])
    g = client.get(f"/care/children/{family['child']}/goals", headers=family["parent"]).json()[0]
    assert (g["status"], g["sessions_in_a_row"]) == ("active", 1)  # a miss breaks the run

    _practise(seeded_db, family["child"], "num_1_5", [True])
    g = client.get(f"/care/children/{family['child']}/goals", headers=family["parent"]).json()[0]
    assert (g["status"], g["sessions_in_a_row"]) == ("met", 2)
    assert g["recent_accuracies"][-3:] == [0, 100, 100]


def test_journal_is_the_familys_alone(client, family):
    url = f"/care/children/{family['child']}/journal"
    entry = {"day": "2026-09-29", "sleep_hours": 9.5, "mood": 4, "tags": ["good_day"], "note": "Tried a new food."}
    assert client.put(url, headers=family["parent"], json=entry).status_code == 200
    again = client.put(url, headers=family["parent"], json={**entry, "mood": 2}).json()  # same day edits, not duplicates
    assert again["mood"] == 2
    assert len(client.get(url, headers=family["parent"]).json()) == 1

    assert client.get(url, headers=family["teacher"]).status_code == 403
    assert client.put(url, headers=family["parent"], json={**entry, "tags": ["made_up"]}).status_code == 400
    assert client.put(url, headers=family["parent"], json={**entry, "mood": 9}).status_code == 400


def test_notes_are_shared_between_parent_and_teacher_but_no_one_else(client, family):
    url = f"/care/children/{family['child']}/notes"
    assert client.post(url, headers=family["teacher"], json={"text": "Counted to 5 with the basket today."}).status_code == 200
    assert client.post(url, headers=family["parent"], json={"text": "Tired after swimming."}).status_code == 200
    notes = client.get(url, headers=family["parent"]).json()
    assert [(n["author_name"], n["author_role"]) for n in notes] == [("Mum", "parent"), ("Ms Lee", "educator")]
    assert client.get(url, headers=family["stranger"]).status_code == 403


def test_sleep_insight_waits_for_enough_days_then_compares_honestly(client, family, seeded_db):
    from datetime import datetime, timedelta, timezone

    from app.models.runtime import Interaction
    from app.services import progress_service

    child = family["child"]
    # six days: three short nights with poor accuracy, three long nights with good accuracy
    plan = [(7.0, False), (7.5, False), (7.0, False), (10.0, True), (9.5, True), (10.0, True)]
    today = datetime.now(timezone.utc).replace(hour=12)
    for i, (sleep, correct) in enumerate(plan):
        before = {x.id for x in seeded_db.query(Interaction).all()}
        _practise(seeded_db, child, "num_1_5", [correct])
        day = today - timedelta(days=i + 1)
        for x in seeded_db.query(Interaction).all():
            if x.id not in before:
                x.server_time = day
        seeded_db.commit()
        client.put(f"/care/children/{child}/journal", headers=family["parent"], json={"day": day.date().isoformat(), "sleep_hours": sleep})
        if i < 5:
            assert progress_service.sleep_insight(seeded_db, child) is None  # never a "pattern" from too few days

    insight = progress_service.sleep_insight(seeded_db, child)
    assert (insight["short_sleep_accuracy"], insight["long_sleep_accuracy"]) == (0, 100)
    assert (insight["short_days"], insight["long_days"]) == (3, 3)
    assert "not proof" in insight["text"]
    # only the family sees it — it comes from their journal
    assert client.get(f"/care/children/{child}/progress", headers=family["teacher"]).json()["sleep_insight"] is None
