"""
End-to-end HTTP tests for Phase 4: a parent grants a teacher access, the
teacher sees the child's detailed profile (with axis evidence explicitly
labelled as internal model estimates, README §2B), locks an arm, and assigns
a topic that the session API then actually honors.
"""
from app.db import get_db
from app.main import app
from tests.test_parent_api import make_client, teardown_function  # noqa: F401  (reuses the fixture wiring)


def _register(client, email, role="parent", name="P"):
    r = client.post("/auth/register", json={"email": email, "password": "x", "display_name": name, "role": role})
    assert r.status_code == 200, r.text
    return r.json()["access_token"], r.json()["user"]


def test_educator_link_and_profile(seeded_db):
    client = make_client(seeded_db)
    parent_token, _ = _register(client, "parent4@example.com")
    parent_headers = {"Authorization": f"Bearer {parent_token}"}

    r = client.post(
        "/parent/children", headers=parent_headers,
        json={"nickname": "Rae", "birth_year_month": "2020-03", "initial_interests": []},
    )
    child_id = r.json()["id"]

    teacher_token, _ = _register(client, "teacher@example.com", role="educator", name="Ms. Byron")
    teacher_headers = {"Authorization": f"Bearer {teacher_token}"}

    # A stranger educator can't see the child yet
    r = client.get(f"/educator/children/{child_id}/profile", headers=teacher_headers)
    assert r.status_code == 403

    # Linking a non-existent / non-educator email fails cleanly
    r = client.post(f"/parent/children/{child_id}/educators", headers=parent_headers, json={"educator_email": "nobody@example.com"})
    assert r.status_code == 404

    r = client.post(f"/parent/children/{child_id}/educators", headers=parent_headers, json={"educator_email": "teacher@example.com"})
    assert r.status_code == 200, r.text

    r = client.get("/educator/children", headers=teacher_headers)
    assert r.status_code == 200
    assert len(r.json()) == 1 and r.json()[0]["id"] == child_id

    r = client.get(f"/educator/children/{child_id}/profile", headers=teacher_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["nickname"] == "Rae"
    assert any(d["domain_code"] == "numeracy" for d in body["domains"])
    axis_codes = {a["axis_code"] for a in body["axes"]}
    # teaching_method + modality + theme are assigned on every lesson activity
    # (docs/PLAN.md Phase 7 added theme as a real axis); intervention is
    # included too even though it's conditionally-triggered (docs/PLAN.md
    # Phase 6) — the educator dashboard shows it regardless of whether it
    # has fired yet for this child.
    assert axis_codes == {"teaching_method", "modality", "theme", "intervention"}
    expected_arm_counts = {"teaching_method": 2, "modality": 2, "theme": 4, "intervention": 4}
    for axis in body["axes"]:
        assert len(axis["arms"]) == expected_arm_counts[axis["axis_code"]]
        for arm in axis["arms"]:
            assert 0 <= arm["accuracy_percent"] <= 100


def test_educator_can_lock_an_arm_and_it_is_actually_enforced(seeded_db):
    client = make_client(seeded_db)
    parent_token, _ = _register(client, "parent5@example.com")
    parent_headers = {"Authorization": f"Bearer {parent_token}"}
    r = client.post("/parent/children", headers=parent_headers, json={"nickname": "Rae", "birth_year_month": "2020-03", "initial_interests": []})
    child_id = r.json()["id"]

    teacher_token, _ = _register(client, "teacher2@example.com", role="educator")
    teacher_headers = {"Authorization": f"Bearer {teacher_token}"}
    client.post(f"/parent/children/{child_id}/educators", headers=parent_headers, json={"educator_email": "teacher2@example.com"})

    r = client.post(
        f"/educator/children/{child_id}/locks", headers=teacher_headers,
        json={"axis_code": "modality", "arm_code": "drag_drop", "allow": False},
    )
    assert r.status_code == 200, r.text

    r = client.get(f"/educator/children/{child_id}/locks", headers=teacher_headers)
    assert {"axis_code": "modality", "arm_code": "drag_drop", "allow": False} in r.json()

    # The lock must actually change what the session API hands the child:
    # run several activities and confirm drag_drop never appears.
    r = client.post("/sessions", json={"child_id": child_id})
    session_id = r.json()["id"]
    seen_modalities = set()
    for _ in range(10):
        activity = client.get(f"/sessions/{session_id}/next-activity").json()
        seen_modalities.add(activity["spec"]["modality"])
        item = activity["spec"]["items"][0]
        client.post(
            f"/sessions/activities/{activity['id']}/answer",
            json={"item_id": item["id"], "correct": True, "response_time_ms": 1000},
        )
    assert seen_modalities == {"tap"}


def test_educator_topic_assignment_is_honored_by_the_session_api(seeded_db):
    client = make_client(seeded_db)
    parent_token, _ = _register(client, "parent6@example.com")
    parent_headers = {"Authorization": f"Bearer {parent_token}"}
    r = client.post("/parent/children", headers=parent_headers, json={"nickname": "Rae", "birth_year_month": "2020-03", "initial_interests": []})
    child_id = r.json()["id"]

    teacher_token, _ = _register(client, "teacher3@example.com", role="educator")
    teacher_headers = {"Authorization": f"Bearer {teacher_token}"}
    client.post(f"/parent/children/{child_id}/educators", headers=parent_headers, json={"educator_email": "teacher3@example.com"})

    r = client.get("/educator/topics", headers=teacher_headers)
    topic_code = r.json()[0]["code"]

    r = client.post(f"/educator/children/{child_id}/assign", headers=teacher_headers, json={"topic_code": topic_code})
    assert r.status_code == 200, r.text

    r = client.post("/sessions", json={"child_id": child_id})
    session_id = r.json()["id"]
    activity = client.get(f"/sessions/{session_id}/next-activity").json()
    assert activity["spec"]["topic_code"] == topic_code
    assert activity["spec"]["topic_reason"] == "educator_assigned"


def test_unknown_topic_or_axis_are_rejected_cleanly(seeded_db):
    client = make_client(seeded_db)
    parent_token, _ = _register(client, "parent7@example.com")
    parent_headers = {"Authorization": f"Bearer {parent_token}"}
    r = client.post("/parent/children", headers=parent_headers, json={"nickname": "Rae", "birth_year_month": "2020-03", "initial_interests": []})
    child_id = r.json()["id"]
    teacher_token, _ = _register(client, "teacher4@example.com", role="educator")
    teacher_headers = {"Authorization": f"Bearer {teacher_token}"}
    client.post(f"/parent/children/{child_id}/educators", headers=parent_headers, json={"educator_email": "teacher4@example.com"})

    r = client.post(f"/educator/children/{child_id}/assign", headers=teacher_headers, json={"topic_code": "not_a_real_topic"})
    assert r.status_code == 404

    r = client.post(
        f"/educator/children/{child_id}/locks", headers=teacher_headers,
        json={"axis_code": "not_a_real_axis", "arm_code": "x", "allow": False},
    )
    assert r.status_code == 404
