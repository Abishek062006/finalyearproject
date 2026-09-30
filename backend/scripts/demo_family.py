"""
Creates a DEMO family for showing AURA to reviewers: a parent account, a
linked teacher account, and a child ("Demo Mia") with two weeks of history —
so the progress charts, "what works", goals and journal have something real
to show.

The history is not invented numbers: a simulated child (research/simulator)
plays through the REAL decision engine, two short sessions a day, and each
session is then moved back to its day. The simulated child's hidden best
teaching method etc. are what the engine has to discover. Journal sleep and
mood are random, so any sleep/learning pattern the app shows is not staged.

    backend/.venv/bin/python -m scripts.demo_family

Demo logins (local development only):
    parent   demo.parent@aura-dev.com   / aura-demo-2026
    teacher  demo.teacher@aura-dev.com  / aura-demo-2026
Re-running replaces the previous demo family.
"""
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))  # repo root, for research/

from app.core.security import hash_password  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.models.identity import Child, EducatorLink, Guardianship, User  # noqa: E402
from app.models.runtime import ActivityInstance, ChildSignal, Interaction  # noqa: E402
from app.models.runtime import Session as SessionModel  # noqa: E402
from app.services import care_service, parent_service, session_service, signal_service  # noqa: E402
from app.engine.learner_model import LearnerModel  # noqa: E402

DEMO_PASSWORD = "aura-demo-2026"
PARENT_EMAIL = "demo.parent@aura-dev.com"
TEACHER_EMAIL = "demo.teacher@aura-dev.com"
DAYS = 14
SESSIONS_PER_DAY = 2
ACTIVITIES_PER_SESSION = 3


def _play_session(db, child_id: str, sim, day: datetime, rng: random.Random) -> None:
    learner = LearnerModel(db)
    session = session_service.start_session(db, child_id)
    sim.reset_daily_distress()
    trial = 0
    for _ in range(ACTIVITIES_PER_SESSION):
        activity = session_service.next_activity(db, session.id)
        spec = activity.spec
        if spec["is_intervention"]:
            sim.apply_intervention_relief(spec.get("intervention_type"))
            session_service.record_answer(db, activity.id, item_id=None, correct=True, response_time_ms=1000)
            continue
        if rng.random() < 0.08:  # now and then the child asks for a break themselves
            signal_service.record_signal(db, child_id, "break", session_id=session.id)
        for item in spec["items"]:
            mastery = learner.get_mastery(child_id, activity.topic_id).p
            correct, rt = sim.answer(method=spec["method"], modality=spec["modality"], theme=spec["theme"], mastery=mastery, trial_in_session=trial)
            session_service.record_answer(db, activity.id, item_id=item["id"], correct=correct, response_time_ms=rt)
            sim.update_distress(correct=correct, method=spec["method"], modality=spec["modality"], theme=spec["theme"])
            trial += 1
    session_service.end_session(db, session.id)

    # Move the whole session back to its day (a few minutes long).
    start = day
    session.started_at = start
    session.ended_at = start + timedelta(minutes=rng.uniform(6, 13))
    session.actual_minutes = (session.ended_at - session.started_at).total_seconds() / 60
    for i, a in enumerate(db.query(ActivityInstance).filter_by(session_id=session.id).all()):
        a.started_at = start + timedelta(minutes=i * 3)
        for x in db.query(Interaction).filter_by(activity_instance_id=a.id).all():
            x.server_time = x.device_time = start + timedelta(minutes=i * 3 + 1)
    for s in db.query(ChildSignal).filter_by(session_id=session.id).all():
        s.created_at = start + timedelta(minutes=2)
    db.commit()


def main() -> None:
    from research.simulator.child import generate_population

    db = SessionLocal()
    rng = random.Random(2026)
    try:
        # Replace any previous demo family (fully erased, like a parent's withdrawal).
        old_parent = db.query(User).filter_by(email=PARENT_EMAIL).one_or_none()
        if old_parent:
            for g in db.query(Guardianship).filter_by(user_id=old_parent.id).all():
                parent_service.withdraw_and_delete_child(db, g.child_id)
        parent = db.query(User).filter_by(email=PARENT_EMAIL).one_or_none() or User(
            email=PARENT_EMAIL, password_hash=hash_password(DEMO_PASSWORD), role="parent", display_name="Demo Parent"
        )
        teacher = db.query(User).filter_by(email=TEACHER_EMAIL).one_or_none() or User(
            email=TEACHER_EMAIL, password_hash=hash_password(DEMO_PASSWORD), role="educator", display_name="Ms Rivera"
        )
        db.add_all([parent, teacher])
        db.flush()

        child = Child(nickname="Demo Mia", birth_year_month="2019-06", created_by=parent.id, communication_level="words", sensory=["sounds"], goals=[])
        child.schedule = [
            {"id": "d1", "label": "Breakfast", "icon": "restaurant"},
            {"id": "d2", "label": "Learning time", "icon": "star"},
            {"id": "d3", "label": "Play outside", "icon": "football"},
            {"id": "d4", "label": "Lunch", "icon": "restaurant"},
            {"id": "d5", "label": "Bath", "icon": "water"},
            {"id": "d6", "label": "Bedtime", "icon": "bed"},
        ]
        db.add(child)
        db.flush()
        db.add(Guardianship(user_id=parent.id, child_id=child.id, relation="parent"))
        db.add(EducatorLink(user_id=teacher.id, child_id=child.id, role="teacher", active=True))
        db.commit()

        sim = generate_population(1, seed=7)[0].clone_for_condition(7)
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        for d in range(DAYS, 0, -1):
            day = today - timedelta(days=d - 1)
            if rng.random() < 0.15 and d > 1:
                continue  # some days off, like real life
            now = datetime.now(timezone.utc)
            for s in range(SESSIONS_PER_DAY):
                when = day + timedelta(hours=9 + s * 7, minutes=rng.randint(0, 40))
                # today's sessions must already have happened
                when = min(when, now - timedelta(minutes=45 * (SESSIONS_PER_DAY - s)))
                _play_session(db, child.id, sim, when, rng)
            care_service.save_journal_entry(
                db, child.id, parent.id, day.date().isoformat(),
                sleep_hours=rng.choice([8, 8.5, 9, 9.5, 10, 10.5, 7.5]), mood=rng.choice([3, 4, 4, 5, 2]),
                tags=rng.sample(["good_day", "tired", "social_win", "new_word", "change_in_routine"], k=rng.choice([0, 1, 1, 2])),
                note="",
            )

        care_service.create_goal(db, child.id, teacher.id, "num_1_5", 80, 3, None)
        care_service.create_goal(db, child.id, parent.id, "letters_a_e", 80, 3, None)
        care_service.add_note(db, child.id, teacher, "Mia counted the basket on her own today and asked for a break once — came back ready after the breathing.")
        care_service.add_note(db, child.id, parent, "Slept badly on Tuesday; shorter session that evening.")

        print(f"Demo family ready: {child.nickname} with {DAYS} days of history.")
        print(f"  parent  {PARENT_EMAIL} / {DEMO_PASSWORD}")
        print(f"  teacher {TEACHER_EMAIL} / {DEMO_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
