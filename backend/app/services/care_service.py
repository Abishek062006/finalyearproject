"""
The family journal, IEP-style learning goals and shared notes (plan Phase 6).

Goals measure themselves: progress is the run of most recent sessions in
which the child's accuracy on the goal's topic reached the target, and a
goal is marked met the moment that run reaches the required length.
"""
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy.orm import Session as DBSession

from app.models.care import CareNote, JournalEntry, LearningGoal
from app.models.curriculum import Topic
from app.models.identity import Child, User
from app.models.runtime import ActivityInstance, Interaction
from app.models.runtime import Session as SessionModel

JOURNAL_TAGS = (
    "good_day", "tired", "meltdown", "shutdown", "new_food", "poor_appetite",
    "social_win", "new_word", "sensory_overload", "change_in_routine", "unwell", "medication_change",
)
MAX_NOTE_CHARS = 1000


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---- journal (parents only) ----

def save_journal_entry(db: DBSession, child_id: str, user_id: str, day: str, sleep_hours: float | None, mood: int | None, tags: list[str], note: str) -> JournalEntry:
    try:
        datetime.strptime(day, "%Y-%m-%d")
    except ValueError:
        raise ValueError("day must be YYYY-MM-DD")
    if sleep_hours is not None and not 0 <= sleep_hours <= 18:
        raise ValueError("sleep must be between 0 and 18 hours")
    if mood is not None and mood not in (1, 2, 3, 4, 5):
        raise ValueError("mood must be 1-5")
    unknown = [t for t in tags if t not in JOURNAL_TAGS]
    if unknown:
        raise ValueError(f"unknown tags: {unknown}")
    entry = db.query(JournalEntry).filter_by(child_id=child_id, day=day).one_or_none()
    if entry is None:
        entry = JournalEntry(child_id=child_id, author_user_id=user_id, day=day, created_at=_now())
        db.add(entry)
    entry.sleep_hours = sleep_hours
    entry.mood = mood
    entry.tags = list(dict.fromkeys(tags))
    entry.note = note.strip()[:MAX_NOTE_CHARS]
    entry.updated_at = _now()
    db.commit()
    db.refresh(entry)
    return entry


def list_journal(db: DBSession, child_id: str, limit: int = 60) -> list[JournalEntry]:
    return db.query(JournalEntry).filter_by(child_id=child_id).order_by(JournalEntry.day.desc()).limit(limit).all()


def delete_journal_entry(db: DBSession, child_id: str, entry_id: str) -> None:
    entry = db.query(JournalEntry).filter_by(id=entry_id, child_id=child_id).one_or_none()
    if entry is None:
        raise LookupError("no such journal entry")
    db.delete(entry)
    db.commit()


# ---- goals (parents and educators) ----

def _session_accuracies(db: DBSession, child_id: str, topic_id: str) -> list[tuple[datetime, float]]:
    """(session start, accuracy on this topic) for every session that
    practised it, oldest first."""
    rows = (
        db.query(Interaction, SessionModel)
        .join(ActivityInstance, ActivityInstance.id == Interaction.activity_instance_id)
        .join(SessionModel, SessionModel.id == ActivityInstance.session_id)
        .filter(
            SessionModel.child_id == child_id,
            ActivityInstance.topic_id == topic_id,
            Interaction.item_id.is_not(None),
            Interaction.correct.is_not(None),
        )
        .all()
    )
    per = defaultdict(lambda: [None, 0, 0])
    for interaction, session in rows:
        p = per[session.id]
        p[0] = session.started_at
        p[1] += 1
        p[2] += int(bool(interaction.correct))
    return sorted(((start, c / n) for start, n, c in per.values()), key=lambda x: x[0])


def goal_progress(db: DBSession, goal: LearningGoal) -> dict:
    topic = db.query(Topic).filter_by(code=goal.topic_code).one_or_none()
    history = _session_accuracies(db, goal.child_id, topic.id) if topic else []
    run = 0
    for _start, acc in reversed(history):
        if acc * 100 >= goal.target_accuracy:
            run += 1
        else:
            break
    if goal.status == "active" and run >= goal.target_sessions:
        goal.status = "met"
        goal.met_at = _now()
        db.commit()
    return {
        "id": goal.id,
        "topic_code": goal.topic_code,
        "topic_label": topic.label if topic else goal.topic_code,
        "statement": goal.statement,
        "target_accuracy": goal.target_accuracy,
        "target_sessions": goal.target_sessions,
        "status": goal.status,
        "sessions_in_a_row": min(run, goal.target_sessions),
        "recent_accuracies": [round(acc * 100) for _s, acc in history[-8:]],
        "created_at": goal.created_at.isoformat(),
        "met_at": goal.met_at.isoformat() if goal.met_at else None,
    }


def create_goal(db: DBSession, child_id: str, user_id: str, topic_code: str, target_accuracy: int, target_sessions: int, statement: str | None) -> LearningGoal:
    topic = db.query(Topic).filter_by(code=topic_code).one_or_none()
    if topic is None:
        raise ValueError(f"unknown topic: {topic_code}")
    if not 50 <= target_accuracy <= 100:
        raise ValueError("target accuracy must be 50-100%")
    if not 1 <= target_sessions <= 10:
        raise ValueError("target sessions must be 1-10")
    child = db.get(Child, child_id)
    text = (statement or "").strip() or (
        f"{child.nickname} will answer {target_accuracy}% correctly in {topic.label}, "
        f"in {target_sessions} session{'s' if target_sessions > 1 else ''} in a row."
    )
    goal = LearningGoal(
        child_id=child_id, author_user_id=user_id, topic_code=topic_code, target_accuracy=target_accuracy,
        target_sessions=target_sessions, statement=text[:240], status="active", created_at=_now(),
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


def list_goals(db: DBSession, child_id: str) -> list[dict]:
    goals = db.query(LearningGoal).filter_by(child_id=child_id).order_by(LearningGoal.created_at.desc()).all()
    return [goal_progress(db, g) for g in goals]


def set_goal_status(db: DBSession, child_id: str, goal_id: str, status: str) -> dict:
    if status not in ("active", "paused"):
        raise ValueError("a goal can be set active or paused (met is decided by the child's progress)")
    goal = db.query(LearningGoal).filter_by(id=goal_id, child_id=child_id).one_or_none()
    if goal is None:
        raise LookupError("no such goal")
    goal.status = status
    goal.met_at = None
    db.commit()
    return goal_progress(db, goal)


# ---- notes (parents and educators) ----

def add_note(db: DBSession, child_id: str, user: User, text: str) -> CareNote:
    text = text.strip()
    if not text:
        raise ValueError("a note can't be empty")
    note = CareNote(
        child_id=child_id, author_user_id=user.id, author_name=user.display_name,
        author_role="educator" if user.role == "educator" else "parent", text=text[:MAX_NOTE_CHARS], created_at=_now(),
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def list_notes(db: DBSession, child_id: str, limit: int = 50) -> list[CareNote]:
    return db.query(CareNote).filter_by(child_id=child_id).order_by(CareNote.created_at.desc()).limit(limit).all()
