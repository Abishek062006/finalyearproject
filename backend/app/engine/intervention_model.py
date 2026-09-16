"""
InterventionModel — records what happened around a short re-engagement
interlude (README §15/§16) and turns "did it work" into an Outcome that
feeds the SAME Thompson-sampling machinery already built for teaching_method
and modality (docs/PLAN.md Phase 4/6). Arm SELECTION itself stays in
DecisionEngine.choose_arm — it's already generic over any axis; this module
is about persistence and scoring, not picking.

README §16, explicitly: "Do not hard-code: IF distracted THEN dinosaur.
Instead use a decision model/policy that learns from previous outcomes."
Reusing the existing per-child Beta-Binomial posterior IS that policy.
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session as DBSession

from app.engine.engagement_model import EngagementModel, EngagementReading, engagement_score
from app.models.experiment import Outcome
from app.models.runtime import InterventionEvent

INTERVENTION_DURATION_S = 12  # within README §32's 5-20s range


class InterventionModel:
    def __init__(self, db: DBSession):
        self.db = db
        self.engagement_model = EngagementModel(db)

    def has_pending(self, session_id: str) -> bool:
        """README §32: interventions are short interludes, not stacked back
        to back — don't trigger another one while one is still awaiting its
        recovery reading."""
        return (
            self.db.query(InterventionEvent)
            .filter_by(session_id=session_id, engagement_after_60s=None)
            .first()
            is not None
        )

    def record_start(
        self, session_id: str, engagement_before: EngagementReading, arm_id: str, assignment_id: str | None
    ) -> InterventionEvent:
        event = InterventionEvent(
            session_id=session_id,
            triggered_at=datetime.now(timezone.utc),
            engagement_before=engagement_score(engagement_before),
            intervention_arm_id=arm_id,
            duration_s=INTERVENTION_DURATION_S,
            assignment_id=assignment_id,
        )
        self.db.add(event)
        self.db.flush()
        return event

    def finalize_pending(self, child_id: str, session_id: str) -> None:
        """Called once the child has answered something REAL after an
        intervention (session_service.record_answer) — measures whether
        engagement actually recovered and attributes the result back to the
        arm that was shown, closing the loop README §16 asks for."""
        pending = (
            self.db.query(InterventionEvent)
            .filter_by(session_id=session_id, engagement_after_60s=None)
            .order_by(InterventionEvent.triggered_at.asc())
            .first()
        )
        if pending is None:
            return

        reading_after = self.engagement_model.estimate(child_id, session_id)
        score = engagement_score(reading_after)
        pending.engagement_after_60s = score

        if pending.assignment_id:
            self.db.add(Outcome(assignment_id=pending.assignment_id, kind="engagement_60s", value=score, n=1))
        self.db.flush()
