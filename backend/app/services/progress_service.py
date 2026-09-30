"""
Progress over time for the grown-ups (plan Phase 6): day-by-day charts,
session history, "what works for this child" in plain words, and — once
the family journal has enough days — an honest look at how sleep lines up
with learning.
"""
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from statistics import median

from sqlalchemy.orm import Session as DBSession

from app.models.care import JournalEntry
from app.models.curriculum import Theme, Topic
from app.models.runtime import ActivityInstance, ChildSignal, Interaction
from app.models.runtime import Session as SessionModel
from app.services.educator_service import axis_evidence

# How each arm is said to a parent (never the internal code).
ARM_WORDS = {
    "errorless": "being shown the answer first, then trying",
    "try_then_correct": "trying first, with a gentle correction",
    "tap": "tapping",
    "drag_drop": "dragging and dropping",
    "mini_game": "a quick game",
    "interest_injection": "their favourite thing",
    "modality_switch": "switching to a different way to answer",
    "break": "a calm break",
}
AXIS_QUESTION = {
    "teaching_method": "How they learn new things best",
    "modality": "How they like to answer",
    "theme": "Pictures that keep them interested",
    "intervention": "What helps when they get stuck",
}
MIN_DAYS_PER_GROUP = 3  # journal insight: below this, a pattern would just be noise


def _aware(t: datetime) -> datetime:
    return t if t.tzinfo else t.replace(tzinfo=timezone.utc)  # SQLite drops tzinfo


def _answers(db: DBSession, child_id: str):
    return (
        db.query(Interaction, ActivityInstance, SessionModel)
        .join(ActivityInstance, ActivityInstance.id == Interaction.activity_instance_id)
        .join(SessionModel, SessionModel.id == ActivityInstance.session_id)
        .filter(SessionModel.child_id == child_id, Interaction.item_id.is_not(None), Interaction.correct.is_not(None))
        .all()
    )


def daily(db: DBSession, child_id: str, days: int = 14) -> list[dict]:
    """One row per calendar day (oldest first), zeros included, so a chart's
    gaps are real days off rather than missing data."""
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)
    rows = {start + timedelta(d): {"minutes": 0.0, "activities": 0, "answers": 0, "correct": 0, "breaks": 0} for d in range(days)}

    for s in db.query(SessionModel).filter_by(child_id=child_id).all():
        d = _aware(s.started_at).date()
        if d in rows:
            rows[d]["minutes"] += s.actual_minutes or 0
    for interaction, activity, _session in _answers(db, child_id):
        d = _aware(interaction.server_time).date()
        if d in rows:
            rows[d]["answers"] += 1
            rows[d]["correct"] += int(bool(interaction.correct))
    completed = (
        db.query(ActivityInstance)
        .join(SessionModel, SessionModel.id == ActivityInstance.session_id)
        .filter(SessionModel.child_id == child_id, ActivityInstance.completed.is_(True))
        .all()
    )
    for a in completed:
        d = _aware(a.started_at).date()
        if d in rows:
            rows[d]["activities"] += 1
    for sig in db.query(ChildSignal).filter_by(child_id=child_id, kind="break").all():
        d = _aware(sig.created_at).date()
        if d in rows:
            rows[d]["breaks"] += 1

    return [
        {
            "day": d.isoformat(),
            "minutes": round(r["minutes"], 1),
            "activities": r["activities"],
            "answers": r["answers"],
            "accuracy_percent": round(100 * r["correct"] / r["answers"]) if r["answers"] else None,
            "breaks": r["breaks"],
        }
        for d, r in sorted(rows.items())
    ]


def session_history(db: DBSession, child_id: str, limit: int = 20) -> list[dict]:
    sessions = db.query(SessionModel).filter_by(child_id=child_id).order_by(SessionModel.started_at.desc()).limit(limit).all()
    answers = defaultdict(lambda: [0, 0])
    topics: dict[str, set] = defaultdict(set)
    topic_labels = {t.id: t.label for t in db.query(Topic).all()}
    for interaction, activity, session in _answers(db, child_id):
        answers[session.id][0] += 1
        answers[session.id][1] += int(bool(interaction.correct))
        topics[session.id].add(topic_labels.get(activity.topic_id, ""))
    breaks = defaultdict(int)
    for sig in db.query(ChildSignal).filter_by(child_id=child_id, kind="break").all():
        if sig.session_id:
            breaks[sig.session_id] += 1
    out = []
    for s in sessions:
        n, c = answers[s.id]
        activities = sum(1 for a in s.activity_instances if a.completed)
        out.append(
            {
                "id": s.id,
                "started_at": _aware(s.started_at).isoformat(),
                "minutes": round(s.actual_minutes or 0, 1),
                "activities": activities,
                "answers": n,
                "accuracy_percent": round(100 * c / n) if n else None,
                "breaks": breaks[s.id],
                "end_reason": s.end_reason,
                "topics": sorted(t for t in topics[s.id] if t),
            }
        )
    return out


def what_works(db: DBSession, child_id: str) -> list[dict]:
    """The engine's per-child findings, in words a parent or therapist can
    act on. Only a CONFIRMED winner (enough evidence, clearly ahead) is
    stated as a finding; everything else is honestly "still finding out"."""
    themes = {t.code: t.label.lower() for t in db.query(Theme).all()}
    out = []
    for axis in axis_evidence(db, child_id):
        arms = axis["arms"]
        words = lambda code: themes.get(code) or ARM_WORDS.get(code, code.replace("_", " "))  # noqa: E731
        winner = next((a for a in arms if a["is_current_winner"]), None)
        tried = sum(a["trials"] for a in arms)
        item = {"axis_code": axis["axis_code"], "question": AXIS_QUESTION.get(axis["axis_code"], axis["axis_label"]), "trials": tried}
        if winner:
            others = [a for a in arms if a is not winner and a["trials"] > 0]
            best_other = max(others, key=lambda a: a["accuracy_percent"], default=None)
            detail = f"{winner['accuracy_percent']}% success"
            if best_other:
                detail += f", compared with {best_other['accuracy_percent']}% with {words(best_other['arm_code'])}"
            item.update(confirmed=True, answer=words(winner["arm_code"]).capitalize(), detail=f"{detail} (from {tried} tries).")
        else:
            item.update(confirmed=False, answer="Still finding out", detail=f"{tried} tries so far — AURA keeps comparing until one is clearly better.")
        out.append(item)
    return out


def sleep_insight(db: DBSession, child_id: str) -> dict | None:
    """How accuracy on days after shorter sleep compares with days after
    longer sleep, split at the child's own median. Returns None until each
    side has MIN_DAYS_PER_GROUP days with both a journal entry and answers —
    and says plainly that it is a pattern, not proof."""
    entries = {e.day: e.sleep_hours for e in db.query(JournalEntry).filter_by(child_id=child_id).all() if e.sleep_hours is not None}
    if len(entries) < 2 * MIN_DAYS_PER_GROUP:
        return None
    per_day = defaultdict(lambda: [0, 0])
    for interaction, _a, _s in _answers(db, child_id):
        d = _aware(interaction.server_time).date().isoformat()
        per_day[d][0] += 1
        per_day[d][1] += int(bool(interaction.correct))
    paired = [(hours, per_day[d][1] / per_day[d][0]) for d, hours in entries.items() if per_day[d][0]]
    if len(paired) < 2 * MIN_DAYS_PER_GROUP:
        return None
    cut = median(h for h, _ in paired)
    short = [acc for h, acc in paired if h < cut]
    long_ = [acc for h, acc in paired if h >= cut]
    if len(short) < MIN_DAYS_PER_GROUP or len(long_) < MIN_DAYS_PER_GROUP:
        return None
    short_pct = round(100 * sum(short) / len(short))
    long_pct = round(100 * sum(long_) / len(long_))
    return {
        "cut_hours": cut,
        "short_sleep_accuracy": short_pct,
        "long_sleep_accuracy": long_pct,
        "short_days": len(short),
        "long_days": len(long_),
        "text": (
            f"After less than {cut:g} hours of sleep, answers were {short_pct}% right ({len(short)} days); "
            f"after {cut:g} hours or more, {long_pct}% ({len(long_)} days). This is a pattern to watch, not proof."
        ),
    }
