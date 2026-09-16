"""
RetentionModel — "when will this child forget this, and did they?"

Half-life regression (the mechanism behind Anki/SuperMemo/FSRS-style spaced
repetition, docs/README.md §4 "Filling the gap"): retention decays as
R(t) = 2^(-t / half_life). A correct answer roughly doubles the half-life
(spacing effect); an incorrect one shrinks it back down. This is intentionally
the same well-understood mechanism referenced for evaluation in
docs/PLAN.md Phase 8 ("validated first on the public Anki datasets"), just
applied online here instead of offline.

This deliberately estimates a DURATION ("estimated learning retention" /
"predicted revision need", README §13), never framed as a clinical memory
measurement.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session as DBSession

from app.engine.learner_model import LearnerModel
from app.models.curriculum import Topic
from app.models.profile_state import RetentionState
from app.models.runtime import ScheduledProbe

INITIAL_HALF_LIFE_DAYS = 7.0
MIN_HALF_LIFE_DAYS = 1.0
MAX_HALF_LIFE_DAYS = 90.0
GROWTH_ON_SUCCESS = 2.0
SHRINK_ON_FAILURE = 0.5

REVISION_THRESHOLD = 0.7  # retention below this -> "topics to review" (README §9/§13)
AUDIT_MASTERY_THRESHOLD = 0.85  # LearnerModel mastery high enough to be worth spot-checking
PROBE_DELAYS_DAYS = (3, 7)  # docs/PLAN.md Phase 5: "3-day and 7-day retention probes"


@dataclass
class RevisionCandidate:
    topic_id: str
    topic_code: str
    topic_label: str
    retention_percent: int


class RetentionModel:
    def __init__(self, db: DBSession):
        self.db = db
        self.learner_model = LearnerModel(db)

    # ---- core forgetting curve ----

    def _row(self, child_id: str, topic_id: str) -> RetentionState:
        row = self.db.query(RetentionState).filter_by(child_id=child_id, topic_id=topic_id).one_or_none()
        if row is None:
            row = RetentionState(child_id=child_id, topic_id=topic_id)  # column defaults apply
            self.db.add(row)
            self.db.flush()
        return row

    def current_retention(self, child_id: str, topic_id: str, at: datetime | None = None) -> float:
        """R(t) = retention_estimate * 2^(-t/half_life): decays from whatever
        was actually observed at the last practice, NOT always from 1.0.
        This matters right after a wrong answer — at t=0 the plain 2^0 term
        is always 1.0 regardless of correctness, which would say "fully
        retained" the instant a child just got it wrong. Scaling by the
        stored retention_estimate (1.0 if that answer was correct, 0.3 if
        not — set in update()) means a fresh mistake is reflected
        immediately instead of only once enough time has passed to decay
        into "needs review" on its own.

        A topic never practiced has no forgetting curve yet — treated as 1.0
        (not due), since there is nothing to forget."""
        row = self._row(child_id, topic_id)
        if row.last_probe_at is None:
            return 1.0
        now = at or datetime.now(timezone.utc)
        last = row.last_probe_at.replace(tzinfo=None)
        elapsed_days = max(0.0, (now.replace(tzinfo=None) - last).total_seconds() / 86400)
        return row.retention_estimate * (2 ** (-elapsed_days / row.half_life_days))

    def update(self, child_id: str, topic_id: str, correct: bool) -> RetentionState:
        """Called on every answer (probe or ordinary practice) — both are
        real evidence about how durably this child holds the material."""
        row = self._row(child_id, topic_id)
        if correct:
            row.half_life_days = min(MAX_HALF_LIFE_DAYS, row.half_life_days * GROWTH_ON_SUCCESS)
        else:
            row.half_life_days = max(MIN_HALF_LIFE_DAYS, row.half_life_days * SHRINK_ON_FAILURE)
        now = datetime.now(timezone.utc)
        row.last_probe_at = now
        row.retention_estimate = 1.0 if correct else 0.3  # snapshot; current_retention() is the live value
        row.next_due_at = now + timedelta(days=row.half_life_days)
        row.revision_priority = "low"
        self.db.flush()
        return row

    # ---- what needs review (parent/educator-facing) ----

    def due_for_revision(self, child_id: str, limit: int = 5) -> list[RevisionCandidate]:
        rows = self.db.query(RetentionState).filter_by(child_id=child_id).filter(RetentionState.last_probe_at.isnot(None)).all()
        candidates = []
        for row in rows:
            retention = self.current_retention(child_id, row.topic_id)
            if retention >= REVISION_THRESHOLD:
                continue
            row.revision_priority = "high" if retention < 0.4 else "medium"
            topic = self.db.query(Topic).filter_by(id=row.topic_id).one()
            candidates.append(
                RevisionCandidate(topic_id=topic.id, topic_code=topic.code, topic_label=topic.label, retention_percent=round(retention * 100))
            )
        self.db.flush()
        candidates.sort(key=lambda c: c.retention_percent)
        return candidates[:limit]

    # ---- scheduling delayed probes (the delayed-outcome mechanism) ----

    def schedule_probes_for_assignments(self, child_id: str, topic_id: str, item_set_id: str | None, assignment_ids: list[str]) -> None:
        """After a topic is freshly practiced, schedule a 3-day and a 7-day
        check-back PER teaching assignment involved (one per active axis),
        so a later result can be attributed back to the specific
        method/modality that taught it (docs/ARCHITECTURE.md §5).

        Deduped per (child, topic, delay_days), NOT per exact assignment_id:
        every call to DecisionEngine.decide() logs a brand-new Assignment row
        even when the same arm is chosen again (Phase 4's audit trail, by
        design), so an assignment-level dedup key would never actually match
        on a second practice round and would schedule a fresh batch every
        time the child re-practices the same topic in one sitting. Topic-
        level dedup means only the FIRST practice of a topic in a given
        "unforgotten" stretch claims the check-back; that is the block being
        judged for durability anyway, since nothing has been marked forgotten
        again yet."""
        now = datetime.now(timezone.utc)
        for delay_days in PROBE_DELAYS_DAYS:
            already_pending = (
                self.db.query(ScheduledProbe)
                .filter_by(child_id=child_id, topic_id=topic_id, delay_days=delay_days, status="pending")
                .first()
            )
            if already_pending:
                continue
            for assignment_id in assignment_ids:
                self.db.add(
                    ScheduledProbe(
                        child_id=child_id,
                        topic_id=topic_id,
                        item_set_id=item_set_id,
                        source_assignment_id=assignment_id,
                        due_at=now + timedelta(days=delay_days),
                        delay_days=delay_days,
                        status="pending",
                    )
                )
        self.db.flush()

    def maybe_schedule_audit_probes(self, child_id: str, max_new: int = 1) -> None:
        """README §13/docs/PLAN.md Phase 5: random re-tests on topics the
        model currently believes are mastered, independent of confidence —
        otherwise the system only ever "notices" forgetting via the delayed
        probes it already expects, and quietly keeps believing whatever it
        already believes about everything else."""
        topics = self.db.query(Topic).all()
        scheduled = 0
        now = datetime.now(timezone.utc)
        for topic in topics:
            if scheduled >= max_new:
                break
            mastery = self.learner_model.get_mastery(child_id, topic.id)
            if mastery.p < AUDIT_MASTERY_THRESHOLD:
                continue
            pending = (
                self.db.query(ScheduledProbe)
                .filter_by(child_id=child_id, topic_id=topic.id, delay_days=0, status="pending")
                .first()
            )
            if pending:
                continue
            self.db.add(
                ScheduledProbe(
                    child_id=child_id, topic_id=topic.id, item_set_id=None, source_assignment_id=None,
                    due_at=now, delay_days=0, status="pending",
                )
            )
            scheduled += 1
        self.db.flush()

    def due_probes_for_topic(self, child_id: str, topic_id: str, at: datetime | None = None) -> list[ScheduledProbe]:
        now = at or datetime.now(timezone.utc)
        return (
            self.db.query(ScheduledProbe)
            .filter(
                ScheduledProbe.child_id == child_id,
                ScheduledProbe.topic_id == topic_id,
                ScheduledProbe.status == "pending",
                ScheduledProbe.due_at <= now,
            )
            .all()
        )

    def earliest_due_topic(self, child_id: str, at: datetime | None = None) -> Topic | None:
        """README §21/§33: revision takes priority over introducing new
        material once something is actually due — but an educator's explicit
        assignment (checked first, in SessionPlanner) still wins over this."""
        now = at or datetime.now(timezone.utc)
        probe = (
            self.db.query(ScheduledProbe)
            .filter(ScheduledProbe.child_id == child_id, ScheduledProbe.status == "pending", ScheduledProbe.due_at <= now)
            .order_by(ScheduledProbe.due_at.asc())
            .first()
        )
        if probe is None:
            return None
        return self.db.query(Topic).filter_by(id=probe.topic_id).one_or_none()
