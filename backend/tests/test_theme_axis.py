"""
Phase 7 acceptance test (docs/PLAN.md): "the same lesson renders in two
themes with genuinely matched difficulty" — and interest is now measured
from a RANDOMIZED comparison, not inferred from which theme a child happens
to click on (README §6/§7).
"""
from app.engine.decision_engine import DecisionEngine
from app.engine.experiment_manager import ArmChoice
from app.models.curriculum import Item, Theme
from app.models.experiment import Assignment, Axis, Outcome
from app.services import session_service, content_bank


def test_theme_is_actually_randomized_not_a_static_default(seeded_db, child_id):
    seen_themes = set()
    for i in range(15):
        engine = DecisionEngine(seeded_db, random_seed=i)
        session = session_service.start_session(seeded_db, child_id)
        activity = session_service.next_activity(seeded_db, session.id)
        seen_themes.add(activity.spec["theme"])

    # With no confirmed winner yet, Thompson sampling should explore more
    # than one theme — a hardcoded default would only ever show exactly one.
    assert len(seen_themes) > 1


def test_the_item_sets_items_actually_belong_to_the_chosen_theme(seeded_db, child_id):
    session = session_service.start_session(seeded_db, child_id)
    activity = session_service.next_activity(seeded_db, session.id)

    theme = seeded_db.query(Theme).filter_by(code=activity.spec["theme"]).one()
    item_ids = [i["id"] for i in activity.spec["items"]]
    rows = seeded_db.query(Item).filter(Item.id.in_(item_ids)).all()
    assert all(row.theme_id == theme.id for row in rows)


def test_prompt_text_comes_from_the_content_bank_and_matches_the_theme(seeded_db, child_id):
    session = session_service.start_session(seeded_db, child_id)
    activity = session_service.next_activity(seeded_db, session.id)

    expected = content_bank.get_theme_content(activity.spec["theme"])["counting_prompt"]
    assert activity.spec["prompt_text"] == expected
    # Different themes must actually say different things — proves this
    # isn't a single hardcoded string reused everywhere.
    assert content_bank.get_theme_content("dino")["counting_prompt"] != content_bank.get_theme_content("space")["counting_prompt"]


def test_a_confirmed_theme_winner_is_exploited_thereafter(seeded_db, child_id):
    axis = seeded_db.query(Axis).filter_by(code="theme").one()
    from app.models.experiment import Arm

    winner_arm = seeded_db.query(Arm).filter_by(axis_id=axis.id, code="dino").one()
    other_arms = seeded_db.query(Arm).filter_by(axis_id=axis.id).filter(Arm.code != "dino").all()

    engine = DecisionEngine(seeded_db, random_seed=1)
    win_choice = ArmChoice(
        axis_id=axis.id, axis_code=axis.code, arm_id=winner_arm.id, arm_code=winner_arm.code,
        decision_type="explore", reason="test", candidate_arm_ids=[winner_arm.id] + [a.id for a in other_arms],
    )
    for _ in range(20):
        a = engine.experiments.record_assignment(child_id, win_choice, seed=1, posterior_snapshot={}, distress_level=0.0)
        seeded_db.add(Outcome(assignment_id=a.id, kind="immediate", value=1.0, n=1))
    # Give the others real (lower) evidence too, or an unexplored arm's wide
    # posterior can't be confidently beaten (see docs/PLAN.md Phase 4 note).
    for other in other_arms:
        lose_choice = ArmChoice(
            axis_id=axis.id, axis_code=axis.code, arm_id=other.id, arm_code=other.code,
            decision_type="explore", reason="test", candidate_arm_ids=[winner_arm.id] + [a.id for a in other_arms],
        )
        for i in range(10):
            a = engine.experiments.record_assignment(child_id, lose_choice, seed=1, posterior_snapshot={}, distress_level=0.0)
            seeded_db.add(Outcome(assignment_id=a.id, kind="immediate", value=1.0 if i < 2 else 0.0, n=1))
    seeded_db.commit()

    session = session_service.start_session(seeded_db, child_id)
    activity = session_service.next_activity(seeded_db, session.id)
    assert activity.spec["theme"] == "dino"
    assert activity.spec["decision_types"]["theme"] == "exploit"


def test_interest_summary_is_empty_until_the_theme_axis_has_evidence(seeded_db, child_id):
    from app.services import parent_service

    assert parent_service.interest_summary(seeded_db, child_id) == []


def test_interest_summary_surfaces_the_confirmed_winner_as_high_interest(seeded_db, child_id):
    """README §2A #10: parents see a friendly tier label, never raw
    percentages or posterior means (those stay on the educator dashboard)."""
    from app.models.experiment import Arm
    from app.services import parent_service

    axis = seeded_db.query(Axis).filter_by(code="theme").one()
    winner_arm = seeded_db.query(Arm).filter_by(axis_id=axis.id, code="space").one()
    other_arms = seeded_db.query(Arm).filter_by(axis_id=axis.id).filter(Arm.code != "space").all()

    engine = DecisionEngine(seeded_db, random_seed=1)
    win_choice = ArmChoice(
        axis_id=axis.id, axis_code=axis.code, arm_id=winner_arm.id, arm_code=winner_arm.code,
        decision_type="explore", reason="test", candidate_arm_ids=[winner_arm.id] + [a.id for a in other_arms],
    )
    for _ in range(20):
        a = engine.experiments.record_assignment(child_id, win_choice, seed=1, posterior_snapshot={}, distress_level=0.0)
        seeded_db.add(Outcome(assignment_id=a.id, kind="immediate", value=1.0, n=1))
    for other in other_arms:
        lose_choice = ArmChoice(
            axis_id=axis.id, axis_code=axis.code, arm_id=other.id, arm_code=other.code,
            decision_type="explore", reason="test", candidate_arm_ids=[winner_arm.id] + [a.id for a in other_arms],
        )
        for i in range(10):
            a = engine.experiments.record_assignment(child_id, lose_choice, seed=1, posterior_snapshot={}, distress_level=0.0)
            seeded_db.add(Outcome(assignment_id=a.id, kind="immediate", value=1.0 if i < 2 else 0.0, n=1))
    seeded_db.commit()

    interests = parent_service.interest_summary(seeded_db, child_id)
    by_code = {i["theme_code"]: i["level"] for i in interests}
    assert by_code["space"] == "high_interest"
    assert set(by_code.keys()) == {"dino", "space", "ocean", "cars"}
    for i in interests:
        assert set(i.keys()) == {"theme_code", "theme_label", "level"}  # no raw numbers exposed


def test_theme_assignment_is_linked_and_auditable(seeded_db, child_id):
    session = session_service.start_session(seeded_db, child_id)
    activity = session_service.next_activity(seeded_db, session.id)

    axis_codes = {
        seeded_db.query(Axis).filter_by(id=a.axis_id).one().code
        for a in seeded_db.query(Assignment).filter_by(child_id=child_id).all()
    }
    assert axis_codes == {"teaching_method", "modality", "theme"}
