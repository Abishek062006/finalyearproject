"""
Phase 9 pilot-readiness: offline mode (docs/ARCHITECTURE.md §8) needs
record_answer to be idempotent on a client-generated interaction id, so a
retried submit after a dropped connection can never double-count mastery,
outcomes, or probe scheduling.
"""
import uuid

from app.models.profile_state import MasteryState
from app.models.runtime import Interaction
from app.services import session_service


def test_retrying_the_same_interaction_id_does_not_double_count(seeded_db, child_id):
    session = session_service.start_session(seeded_db, child_id)
    activity = session_service.next_activity(seeded_db, session.id)
    item = activity.spec["items"][0]
    client_id = str(uuid.uuid4())

    first = session_service.record_answer(
        seeded_db, activity.id, item_id=item["id"], correct=True, response_time_ms=1000, interaction_id=client_id
    )
    assert first.id == client_id

    # Two topics are seeded now (docs/PLAN.md content-breadth follow-up), so
    # a plain child_id filter is no longer guaranteed to be a single row —
    # SessionPlanner.next_topic reads (and thereby lazily creates, via
    # LearnerModel._row) a mastery row for every topic just to compare them.
    mastery = seeded_db.query(MasteryState).filter_by(child_id=child_id, topic_id=activity.spec["topic_id"]).one()
    assert mastery.trials == 1

    # Simulate a dropped-connection retry: same activity, same item, SAME client id.
    retry = session_service.record_answer(
        seeded_db, activity.id, item_id=item["id"], correct=True, response_time_ms=1000, interaction_id=client_id
    )
    assert retry.id == client_id

    seeded_db.refresh(mastery)
    assert mastery.trials == 1, "a retried answer with the same interaction_id must not be recorded twice"
    assert seeded_db.query(Interaction).filter_by(id=client_id).count() == 1


def test_without_an_interaction_id_behaviour_is_unchanged(seeded_db, child_id):
    session = session_service.start_session(seeded_db, child_id)
    activity = session_service.next_activity(seeded_db, session.id)
    item = activity.spec["items"][0]

    interaction = session_service.record_answer(seeded_db, activity.id, item_id=item["id"], correct=True, response_time_ms=1000)
    assert interaction.id is not None
    mastery = seeded_db.query(MasteryState).filter_by(child_id=child_id, topic_id=activity.spec["topic_id"]).one()
    assert mastery.trials == 1


def test_an_answer_for_an_unknown_activity_is_a_clear_not_found(seeded_db):
    """A queued offline answer can outlive its activity (data deleted on
    consent withdrawal, a wiped dev DB). That must be a permanent "not found"
    the client can drop — not a server crash it retries forever."""
    import pytest

    with pytest.raises(LookupError):
        session_service.record_answer(
            seeded_db, "no-such-activity", item_id=None, correct=True, response_time_ms=0, interaction_id=str(uuid.uuid4())
        )
