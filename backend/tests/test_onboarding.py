"""
Plan Phase 1: the new onboarding flow — one atomic call that creates a child
with a communication level, sensory profile, goals and several interests
(real photos, one favourite). Network downloads are replaced by a fake that
still runs the real URL safety check, so the SSRF guard is exercised too.
"""
import pytest
from fastapi.testclient import TestClient

from app.db import get_db
from app.engine.session_planner import SessionPlanner
from app.main import app
from app.models.curriculum import Domain, Theme, Topic
from app.models.identity import Child, ChildInterest
from app.models.profile_state import InterestState
from app.services import companion_service, interest_service, parent_service

WIKI = "https://upload.wikimedia.org/wikipedia/commons/a/ab/"


@pytest.fixture()
def media(tmp_path, monkeypatch):
    monkeypatch.setattr(companion_service, "MEDIA_DIR", tmp_path / "companions")
    monkeypatch.setattr(interest_service, "INTERESTS_DIR", tmp_path / "interests")

    def fake_download(url, dest, size=480):
        companion_service.validate_image_url(url)  # keep the real safety check
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(b"jpg")

    monkeypatch.setattr(companion_service, "_download_and_square", fake_download)
    return tmp_path


@pytest.fixture()
def client(seeded_db):
    def _override():
        yield seeded_db

    app.dependency_overrides[get_db] = _override
    yield TestClient(app)
    app.dependency_overrides.clear()


def _parent_headers(client, email="onboard@example.com"):
    r = client.post("/auth/register", json={"email": email, "password": "x", "display_name": "P", "role": "parent"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


ONBOARD = {
    "nickname": "Rae",
    "birth_year_month": "2020-03",
    "communication_level": "words",
    "sensory": ["sounds", "motion"],
    "goals": ["literacy", "numeracy"],
    "interests": [
        {"label": "trains", "image_url": WIKI + "train.jpg", "source_title": "Train.jpg"},
        {"label": "dinosaurs", "image_url": WIKI + "dino.jpg", "source_title": "Dino.jpg", "favourite": True},
    ],
}


def test_onboarding_creates_a_complete_child_in_one_call(client, media, seeded_db):
    headers = _parent_headers(client)
    r = client.post("/parent/children/onboard", headers=headers, json=ONBOARD)
    assert r.status_code == 200, r.text
    child = r.json()

    assert child["communication_level"] == "words"
    assert child["sensory"] == ["motion", "sounds"]
    assert child["goals"] == ["literacy", "numeracy"]
    assert [i["label"] for i in child["interests"]] == ["trains", "dinosaurs"]
    assert [i["is_favourite"] for i in child["interests"]] == [False, True]
    # The favourite becomes the guide companion the DecisionEngine already reads.
    assert child["companion_name"] == "Dinosaurs"
    assert child["companion_image_url"] == child["interests"][1]["image_url"]
    for interest in child["interests"]:
        assert (media / interest["image_url"].removeprefix("/media/")).exists()

    # "dinosaurs" matches the built-in dino theme, so it seeds that theme's prior (README §6).
    dino = seeded_db.query(Theme).filter_by(code="dino").one()
    assert seeded_db.query(InterestState).filter_by(child_id=child["id"], theme_id=dino.id).one().parent_prior == 1.0


def test_onboarding_refuses_images_from_outside_the_search_results_and_writes_nothing(client, media, seeded_db):
    headers = _parent_headers(client)
    bad = {**ONBOARD, "interests": [{"label": "trains", "image_url": "http://169.254.169.254/latest/meta-data", "source_title": "x"}]}
    r = client.post("/parent/children/onboard", headers=headers, json=bad)
    assert r.status_code == 400
    assert seeded_db.query(Child).count() == 0  # all-or-nothing: no half-created child


def test_onboarding_rejects_unknown_profile_values(client, media):
    headers = _parent_headers(client)
    for field, value in (("communication_level", "telepathy"), ("sensory", ["smells"]), ("goals", ["astrophysics"])):
        r = client.post("/parent/children/onboard", headers=headers, json={**ONBOARD, field: value})
        assert r.status_code == 400, field
    r = client.post("/parent/children/onboard", headers=headers, json={**ONBOARD, "birth_year_month": "2020-13"})
    assert r.status_code == 422


def test_profile_can_be_edited_later(client, media):
    headers = _parent_headers(client)
    child = client.post("/parent/children/onboard", headers=headers, json=ONBOARD).json()
    r = client.patch(f"/parent/children/{child['id']}", headers=headers, json={"sensory": ["timers"], "communication_level": "sentences"})
    assert r.status_code == 200, r.text
    assert r.json()["sensory"] == ["timers"]
    assert r.json()["communication_level"] == "sentences"
    assert r.json()["goals"] == ["literacy", "numeracy"]  # untouched fields stay


def test_interests_can_be_added_refavourited_and_removed(client, media):
    headers = _parent_headers(client)
    child = client.post("/parent/children/onboard", headers=headers, json=ONBOARD).json()
    cid = child["id"]

    r = client.post(f"/parent/children/{cid}/interests", headers=headers, json={"label": "space", "image_url": WIKI + "rocket.jpg", "source_title": "Rocket.jpg"})
    assert r.status_code == 200, r.text
    space = next(i for i in r.json()["interests"] if i["label"] == "space")
    assert not space["is_favourite"]  # adding doesn't steal the favourite

    r = client.post(f"/parent/children/{cid}/interests/{space['id']}/favourite", headers=headers)
    assert r.json()["companion_name"] == "Space"

    r = client.delete(f"/parent/children/{cid}/interests/{space['id']}", headers=headers)
    body = r.json()
    assert [i["label"] for i in body["interests"]] == ["trains", "dinosaurs"]
    assert sum(i["is_favourite"] for i in body["interests"]) == 1  # a new favourite was promoted
    assert body["companion_name"] in ("Trains", "Dinosaurs")


def test_removing_the_last_interest_clears_the_companion(client, media):
    headers = _parent_headers(client)
    child = client.post("/parent/children/onboard", headers=headers, json={**ONBOARD, "interests": ONBOARD["interests"][:1]}).json()
    only = child["interests"][0]
    r = client.delete(f"/parent/children/{child['id']}/interests/{only['id']}", headers=headers)
    assert r.json()["interests"] == []
    assert r.json()["companion_name"] is None


def test_a_stranger_cannot_touch_someone_elses_child_profile(client, media):
    child = client.post("/parent/children/onboard", headers=_parent_headers(client, "a@example.com"), json=ONBOARD).json()
    stranger = _parent_headers(client, "b@example.com")
    assert client.get(f"/parent/children/{child['id']}", headers=stranger).status_code == 403
    assert client.patch(f"/parent/children/{child['id']}", headers=stranger, json={"goals": []}).status_code == 403


def test_withdrawal_erases_interest_photos_and_rows(client, media, seeded_db):
    headers = _parent_headers(client)
    child = client.post("/parent/children/onboard", headers=headers, json=ONBOARD).json()
    files = [media / i["image_url"].removeprefix("/media/") for i in child["interests"]]
    assert all(f.exists() for f in files)

    assert client.delete(f"/parent/children/{child['id']}", headers=headers).status_code == 200
    assert not any(f.exists() for f in files)
    assert seeded_db.query(ChildInterest).count() == 0


def test_goals_steer_the_planner_toward_those_domains(seeded_db, child_id):
    literacy = seeded_db.query(Domain).filter_by(code="literacy").one()
    parent_service.update_child_profile(seeded_db, child_id, {"goals": ["literacy"]})
    choice = SessionPlanner(seeded_db).next_topic(child_id)
    assert seeded_db.query(Topic).filter_by(id=choice.topic_id).one().domain_id == literacy.id


def test_goals_without_any_topics_yet_fall_back_to_everything(seeded_db, child_id):
    parent_service.update_child_profile(seeded_db, child_id, {"goals": ["social_emotional"]})
    choice = SessionPlanner(seeded_db).next_topic(child_id)  # must not stall
    assert choice.topic_code


@pytest.mark.parametrize(
    "url",
    ["http://upload.wikimedia.org/x.jpg", "https://evil.example.com/x.jpg", "https://upload.wikimedia.org.evil.com/x.jpg", "file:///etc/passwd"],
)
def test_image_url_guard_rejects_anything_but_wikimedia_https(url):
    with pytest.raises(ValueError):
        companion_service.validate_image_url(url)


def test_image_url_guard_accepts_wikimedia_originals_and_thumbnails():
    companion_service.validate_image_url(WIKI + "x.jpg")
    companion_service.validate_image_url("https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/x.jpg/960px-x.jpg?utm_source=commons")


@pytest.mark.parametrize("label,theme", [("Dinosaurs", "dino"), ("rockets", "space"), ("sharks", "ocean"), ("fire engine", "cars"), ("unicorns", None)])
def test_free_text_interests_map_to_built_in_themes(label, theme):
    assert interest_service.infer_theme_code(label) == theme
