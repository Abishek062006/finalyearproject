"""Plan Phase 4: what the child tells us directly (Break / Help / All done,
"How do I feel?", the Talk board) is recorded, feeds the safety layer, and
the parent can give the child a visual schedule."""
import pytest
from fastapi.testclient import TestClient

from app.db import get_db
from app.main import app
from app.models.runtime import ChildSignal
from app.services import session_service, signal_service


@pytest.fixture()
def client(seeded_db):
    def _override():
        yield seeded_db

    app.dependency_overrides[get_db] = _override
    yield TestClient(app)
    app.dependency_overrides.clear()


def _lesson(db, session_id):
    activity = session_service.next_activity(db, session_id)
    while activity.spec["is_intervention"]:
        session_service.record_answer(db, activity.id, item_id=None, correct=True, response_time_ms=1000)
        activity = session_service.next_activity(db, session_id)
    return activity


def _finish(db, activity):
    for item in activity.spec["items"]:
        session_service.record_answer(db, activity.id, item_id=item["id"], correct=True, response_time_ms=1500)


def _decision_types(db, activity) -> set[str]:
    return set(activity.spec["decision_types"].values())


def test_a_break_request_makes_the_next_two_lessons_safe_then_wears_off(seeded_db, child_id):
    session = session_service.start_session(seeded_db, child_id)
    _finish(seeded_db, _lesson(seeded_db, session.id))
    signal_service.record_signal(seeded_db, child_id, "break", session_id=session.id)

    first = _lesson(seeded_db, session.id)
    assert _decision_types(seeded_db, first) == {"safe_fallback"}
    _finish(seeded_db, first)
    second = _lesson(seeded_db, session.id)
    assert _decision_types(seeded_db, second) == {"safe_fallback"}
    _finish(seeded_db, second)
    third = _lesson(seeded_db, session.id)
    assert "safe_fallback" not in _decision_types(seeded_db, third)


def test_an_upset_feeling_counts_like_a_break_but_a_calm_one_does_not(seeded_db, child_id):
    session = session_service.start_session(seeded_db, child_id)
    signal_service.record_signal(seeded_db, child_id, "feeling", {"feeling": "green"}, session_id=session.id)
    assert signal_service.self_report_level(seeded_db, session.id) == 0.0
    signal_service.record_signal(seeded_db, child_id, "feeling", {"feeling": "red"}, session_id=session.id)
    assert signal_service.self_report_level(seeded_db, session.id) >= 0.6


def test_help_requests_add_up_but_are_capped_below_a_break(seeded_db, child_id):
    session = session_service.start_session(seeded_db, child_id)
    signal_service.record_signal(seeded_db, child_id, "help", session_id=session.id)
    assert signal_service.self_report_level(seeded_db, session.id) == pytest.approx(0.2)
    for _ in range(4):
        signal_service.record_signal(seeded_db, child_id, "help", session_id=session.id)
    assert signal_service.self_report_level(seeded_db, session.id) == pytest.approx(0.4)


def test_signals_api_validates_what_it_is_sent(client, seeded_db, child_id):
    ok = client.post("/sessions/signals", json={"child_id": child_id, "kind": "talk", "value": {"words": ["I want", "more"]}})
    assert ok.status_code == 200, ok.text
    assert seeded_db.query(ChildSignal).filter_by(kind="talk").one().value == {"words": ["I want", "more"]}

    assert client.post("/sessions/signals", json={"child_id": child_id, "kind": "shout"}).status_code == 400
    assert client.post("/sessions/signals", json={"child_id": child_id, "kind": "feeling", "value": {"feeling": "purple"}}).status_code == 400
    assert client.post("/sessions/signals", json={"child_id": "nobody", "kind": "break"}).status_code == 404


def test_a_session_can_be_ended_by_the_child(client, seeded_db, child_id):
    session = session_service.start_session(seeded_db, child_id)
    r = client.post(f"/sessions/{session.id}/end", json={"end_reason": "child_all_done"})
    assert r.status_code == 200, r.text
    assert r.json()["end_reason"] == "child_all_done"


def _parent_with_child(client):
    r = client.post("/auth/register", json={"email": "sched@example.com", "password": "x", "display_name": "P", "role": "parent"})
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    child = client.post("/parent/children", headers=headers, json={"nickname": "Sam", "birth_year_month": "2019-05"}).json()
    return headers, child["id"]


def test_parent_sets_a_visual_schedule(client):
    headers, child_id = _parent_with_child(client)
    steps = [
        {"id": "a", "label": "Breakfast", "icon": "restaurant"},
        {"id": "b", "label": "Learning with Pip", "icon": "star"},
        {"id": "c", "label": "Park", "icon": "football"},
    ]
    r = client.patch(f"/parent/children/{child_id}", headers=headers, json={"schedule": steps})
    assert r.status_code == 200, r.text
    assert r.json()["schedule"] == steps

    bad_icon = client.patch(f"/parent/children/{child_id}", headers=headers, json={"schedule": [{"id": "a", "label": "X", "icon": "rocket-launcher"}]})
    assert bad_icon.status_code == 400
    too_long = [{"id": str(i), "label": "Step", "icon": "star"} for i in range(13)]
    assert client.patch(f"/parent/children/{child_id}", headers=headers, json={"schedule": too_long}).status_code == 400
