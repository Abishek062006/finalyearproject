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

    mastery = seeded_db.query(MasteryState).filter_by(child_id=child_id).one()
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
    mastery = seeded_db.query(MasteryState).filter_by(child_id=child_id).one()
    assert mastery.trials == 1
