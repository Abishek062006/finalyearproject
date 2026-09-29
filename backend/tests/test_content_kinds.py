"""
docs/PLAN.md Phase B (content-breadth follow-up): two more activity kinds
beyond counting/letter_identify — "matching" (letters_a_e_match) and
"sequencing" (num_1_5_sequence). Both are whole-board activities the
frontend renders as MatchingBoard.tsx / SequenceBoard.tsx rather than the
one-item-at-a-time tap/drag flow, but the backend contract is the same
ActivitySpec/Item shape as every other topic.
"""
from app.engine.decision_engine import DecisionEngine
from app.models.curriculum import Item, ItemSet, Topic
from app.services import content_bank, educator_service, session_service


def test_matching_topic_is_seeded_with_the_same_letters_as_letter_identify(seeded_db):
    topic = seeded_db.query(Topic).filter_by(code="letters_a_e_match").one()
    sets = seeded_db.query(ItemSet).filter_by(topic_id=topic.id).all()
    assert len(sets) == 4  # one per theme, same convention as every other topic

    sizes = {s.size for s in sets}
    diffs = [s.difficulty_mean for s in sets]
    assert len(sizes) == 1, "matched sets must be equal size"
    assert max(diffs) - min(diffs) <= 0.2, "matched sets must be within +/-0.2 difficulty"

    items = seeded_db.query(Item).filter_by(item_set_id=sets[0].id).all()
    assert {i.answer["label"] for i in items} == {"A", "B", "C", "D", "E"}


def test_sequencing_topic_is_seeded_with_a_valid_position_permutation(seeded_db):
    topic = seeded_db.query(Topic).filter_by(code="num_1_5_sequence").one()
    sets = seeded_db.query(ItemSet).filter_by(topic_id=topic.id).all()
    assert len(sets) == 4

    sizes = {s.size for s in sets}
    diffs = [s.difficulty_mean for s in sets]
    assert len(sizes) == 1, "matched sets must be equal size"
    assert max(diffs) - min(diffs) <= 0.2, "matched sets must be within +/-0.2 difficulty"

    for item_set in sets:
        items = seeded_db.query(Item).filter_by(item_set_id=item_set.id).all()
        positions = sorted(i.answer["position"] for i in items)
        assert positions == [0, 1, 2, 3, 4], "positions must be a full 0..4 permutation, no gaps or dupes"
        # position N must belong to value N+1 — the ordering task itself
        by_position = {i.answer["position"]: i.answer["value"] for i in items}
        assert by_position == {0: 1, 1: 2, 2: 3, 3: 4, 4: 5}


def test_decision_engine_returns_matching_activity_kind_and_prompt(seeded_db, child_id):
    educator_service.assign_topic(seeded_db, child_id, "letters_a_e_match", user_id="test-educator")
    session = session_service.start_session(seeded_db, child_id)
    activity = session_service.next_activity(seeded_db, session.id)

    assert activity.spec["topic_code"] == "letters_a_e_match"
    assert activity.spec["activity_kind"] == "matching"
    assert len(activity.spec["items"]) == 5
    assert all("label" in item["answer"] for item in activity.spec["items"])

    expected = content_bank.get_theme_content(activity.spec["theme"])["match_prompt"]
    assert activity.spec["prompt_text"] == expected
    assert "{" not in activity.spec["prompt_text"]  # whole-board prompt, no per-item placeholder


def test_decision_engine_returns_sequencing_activity_kind_and_prompt(seeded_db, child_id):
    educator_service.assign_topic(seeded_db, child_id, "num_1_5_sequence", user_id="test-educator")
    session = session_service.start_session(seeded_db, child_id)
    activity = session_service.next_activity(seeded_db, session.id)

    assert activity.spec["topic_code"] == "num_1_5_sequence"
    assert activity.spec["activity_kind"] == "sequencing"
    assert len(activity.spec["items"]) == 5
    assert all("value" in item["answer"] and "position" in item["answer"] for item in activity.spec["items"])
    assert all(item["distractors"] == [] for item in activity.spec["items"])

    expected = content_bank.get_theme_content(activity.spec["theme"])["sequence_prompt"]
    assert activity.spec["prompt_text"] == expected
    assert "{" not in activity.spec["prompt_text"]


def test_recording_answers_for_a_matching_activity_updates_mastery_like_any_other_topic(seeded_db, child_id):
    """The whole-board UI is new, but each pair resolved still goes through
    the exact same record_answer/mastery path as a single tap-choice item —
    no special-casing needed on the backend for a "board" activity."""
    educator_service.assign_topic(seeded_db, child_id, "letters_a_e_match", user_id="test-educator")
    session = session_service.start_session(seeded_db, child_id)
    activity = session_service.next_activity(seeded_db, session.id)

    for item in activity.spec["items"]:
        session_service.record_answer(seeded_db, activity.id, item_id=item["id"], correct=True, response_time_ms=1500)

    from app.models.profile_state import MasteryState

    mastery = seeded_db.query(MasteryState).filter_by(child_id=child_id, topic_id=activity.spec["topic_id"]).one()
    assert mastery.trials == 5
