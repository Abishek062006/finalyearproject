"""
What the child tells us directly (plan Phase 4) — Break, Help and All done
presses, "How do I feel?" check-ins, and sentences built on the Talk board.

The safety layer listens to the ones that mean "this is too much right now":
a break request or an upset feeling makes the next two lessons use the
child's safest, most familiar arms (engine/safety.py), and each help request
counts a little toward it.
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session as DBSession

from app.models.identity import Child
from app.models.runtime import ActivityInstance, ChildSignal
from app.models.runtime import Session as SessionModel

KINDS = ("break", "help", "all_done", "feeling", "talk")
FEELINGS = ("green", "blue", "yellow", "red")  # calm/ready · sad/tired · worried/wiggly · angry/upset
UPSET_FEELINGS = ("blue", "red")
MAX_TALK_WORDS = 12

# How much each self-report adds to the distress estimate, and for how many
# of the lessons chosen after it.
BREAK_LEVEL = 0.65  # on its own, past DistressMonitor.RISING_THRESHOLD (0.6)
HELP_LEVEL = 0.2
HELP_CAP = 0.4
LESSONS_AFFECTED = 2


def record_signal(db: DBSession, child_id: str, kind: str, value: dict | None = None, session_id: str | None = None) -> ChildSignal:
    value = dict(value or {})
    if kind not in KINDS:
        raise ValueError(f"unknown signal: {kind}")
    if db.get(Child, child_id) is None:
        raise LookupError(f"child {child_id} not found")
    if session_id is not None:
        session = db.get(SessionModel, session_id)
        if session is None or session.child_id != child_id:
            raise ValueError("that session does not belong to this child")
    if kind == "feeling" and value.get("feeling") not in FEELINGS:
        raise ValueError(f"feeling must be one of {FEELINGS}")
    if kind == "talk":
        words = value.get("words")
        if not isinstance(words, list) or not words or len(words) > MAX_TALK_WORDS or not all(isinstance(w, str) and 0 < len(w) <= 40 for w in words):
            raise ValueError(f"talk needs 1-{MAX_TALK_WORDS} words")
        value = {"words": words}
    signal = ChildSignal(child_id=child_id, session_id=session_id, kind=kind, value=value, created_at=datetime.now(timezone.utc))
    db.add(signal)
    db.commit()
    db.refresh(signal)
    return signal


def self_report_level(db: DBSession, session_id: str) -> float:
    """0..1: how strongly the child has recently told us they need things to
    be easier. Only signals from this session count, and each one lasts for
    the next LESSONS_AFFECTED activities chosen after it."""
    signals = db.query(ChildSignal).filter_by(session_id=session_id).all()
    if not signals:
        return 0.0
    starts = [a.started_at for a in db.query(ActivityInstance).filter_by(session_id=session_id).all()]

    def _aware(t: datetime) -> datetime:
        return t if t.tzinfo else t.replace(tzinfo=timezone.utc)  # SQLite drops tzinfo on round-trip

    def still_active(signal: ChildSignal) -> bool:
        return sum(1 for s in starts if _aware(s) > _aware(signal.created_at)) < LESSONS_AFFECTED

    level = 0.0
    helps = 0
    for s in signals:
        if not still_active(s):
            continue
        if s.kind == "break" or (s.kind == "feeling" and s.value.get("feeling") in UPSET_FEELINGS):
            level = max(level, BREAK_LEVEL)
        elif s.kind == "help":
            helps += 1
    return min(1.0, level + min(HELP_CAP, helps * HELP_LEVEL))
