"""
Drives one simulated child through one condition (either the real
DecisionEngine — optionally an ablated subclass — or a baseline policy) and
returns a RunLog metrics.py can score. See research/__init__.py for why this
talks to app.engine/app.services directly instead of over HTTP.
"""
from datetime import datetime, timedelta, timezone

import research  # noqa: F401 — sys.path bootstrap
from research.db import build_db, register_child, topic_id as get_topic_id
from research.metrics import ActivityRecord, RunLog, TrialRecord
from research.simulator.child import SimulatedChild

from app.engine.decision_engine import DecisionEngine
from app.engine.learner_model import LearnerModel
from app.engine.retention_model import RetentionModel
from app.models.runtime import ScheduledProbe
from app.services import educator_service, session_service

ACTIVITIES_PER_SESSION = 3  # a short daily session, matching README's ~10-15 minute framing
ITEMS_PER_ACTIVITY = 5  # matches the seeded matched item sets (docs/PLAN.md Phase 7)


def _tag_new_probes(db, child_id: str, sim_day: int, scheduled_sim_day: dict[str, int]) -> None:
    for probe in db.query(ScheduledProbe).filter_by(child_id=child_id, status="pending").all():
        scheduled_sim_day.setdefault(probe.id, sim_day)


def _force_due_probes(db, child_id: str, sim_day: int, scheduled_sim_day: dict[str, int]) -> None:
    """The 3-day/7-day probes real users wait real days for (docs/PLAN.md
    Phase 5) — forced due once `sim_day` (one per simulated session, not
    real wall-clock time) says enough simulated days have passed, using the
    same direct-row technique already established in tests/live
    verification for exactly this reason."""
    changed = False
    for probe in db.query(ScheduledProbe).filter_by(child_id=child_id, status="pending").all():
        if probe.delay_days not in (3, 7):
            continue  # audit probes (delay_days=0) are already due at creation
        scheduled_day = scheduled_sim_day.get(probe.id)
        if scheduled_day is not None and sim_day - scheduled_day >= probe.delay_days:
            probe.due_at = datetime.now(timezone.utc) - timedelta(minutes=1)
            changed = True
    if changed:
        db.commit()


def run_aura_condition(
    child: SimulatedChild, *, condition_name: str, engine_cls: type[DecisionEngine], n_activities: int, seed: int
):
    db = build_db()
    child_id = register_child(db, nickname=f"child{child.child_index}")
    topic = get_topic_id(db)
    # Pin the real DecisionEngine to the ORIGINAL evaluation topic explicitly
    # — the curriculum now has a second topic (docs/PLAN.md content-breadth
    # follow-up), and SessionPlanner.next_topic would otherwise be free to
    # route a simulated child to it too, silently changing what Phase 8's
    # already-published studies (research/results/) actually measured.
    # SimulatedChild's own answering model has no notion of "letters" at
    # all, so mixing topics wouldn't just add noise, it would misattribute
    # every metric that assumes `topic` is the only thing being taught.
    educator_service.assign_topic(db, child_id, topic_code="num_1_5", user_id="research-harness")
    learner = LearnerModel(db)
    log = RunLog(condition=condition_name, child_index=child.child_index)

    engine = engine_cls(db, random_seed=seed)
    scheduled_sim_day: dict[str, int] = {}
    sim_day = 0
    activities_done = 0

    while activities_done < n_activities:
        session = session_service.start_session(db, child_id)
        child.reset_daily_distress()
        sim_day += 1
        _force_due_probes(db, child_id, sim_day, scheduled_sim_day)
        trial_in_session = 0

        for _ in range(ACTIVITIES_PER_SESSION):
            if activities_done >= n_activities:
                break
            activity = session_service.next_activity(db, session.id, engine=engine)
            spec = activity.spec

            if spec["is_intervention"]:
                before = child.true_distress
                child.apply_intervention_relief(spec.get("intervention_type"))
                log.intervention_episodes.append((before, child.true_distress))
                session_service.record_answer(db, activity.id, item_id=None, correct=True, response_time_ms=1000)
                log.trials.append(TrialRecord(activity_index=activities_done, correct=None, optimal_p=1.0, actual_p=1.0, is_intervention=True))
                log.distress_trajectory.append(child.true_distress)
                log.activities.append(ActivityRecord(activity_index=activities_done, arms={}, is_intervention=True))
                activities_done += 1
                continue

            arms = {"teaching_method": spec["method"], "modality": spec["modality"], "theme": spec["theme"]}
            log.activities.append(ActivityRecord(activity_index=activities_done, arms=arms))

            abandoned = False
            for item in spec["items"]:
                mastery = learner.get_mastery(child_id, topic).p
                if child.should_abandon():
                    optimal_p = child.optimal_p_correct(mastery=mastery, trial_in_session=trial_in_session)
                    log.trials.append(TrialRecord(activity_index=activities_done, correct=None, optimal_p=optimal_p, actual_p=0.0, abandoned=True))
                    log.distress_trajectory.append(child.true_distress)
                    abandoned = True
                    break
                correct, rt = child.answer(
                    method=arms["teaching_method"], modality=arms["modality"], theme=arms["theme"],
                    mastery=mastery, trial_in_session=trial_in_session,
                )
                actual_p = child.p_correct(
                    method=arms["teaching_method"], modality=arms["modality"], theme=arms["theme"],
                    mastery=mastery, trial_in_session=trial_in_session,
                )
                optimal_p = child.optimal_p_correct(mastery=mastery, trial_in_session=trial_in_session)
                session_service.record_answer(db, activity.id, item_id=item["id"], correct=correct, response_time_ms=rt)
                child.update_distress(correct=correct, method=arms["teaching_method"], modality=arms["modality"], theme=arms["theme"])
                _tag_new_probes(db, child_id, sim_day, scheduled_sim_day)
                log.trials.append(TrialRecord(
                    activity_index=activities_done, correct=correct, optimal_p=optimal_p, actual_p=actual_p,
                    mastery_after=learner.get_mastery(child_id, topic).p,
                ))
                log.distress_trajectory.append(child.true_distress)
                trial_in_session += 1

            activities_done += 1
            if abandoned:
                break  # a real distressed child walking away ends the session early

        session_service.end_session(db, session.id)

    return log, db, child_id, topic


def run_baseline_condition(child: SimulatedChild, *, condition_name: str, policy, n_activities: int):
    db = build_db()
    child_id = register_child(db, nickname=f"child{child.child_index}")
    topic = get_topic_id(db)
    learner = LearnerModel(db)
    retention = RetentionModel(db)
    log = RunLog(condition=condition_name, child_index=child.child_index)

    trial_in_session = 0
    for activity_index in range(n_activities):
        if activity_index % ACTIVITIES_PER_SESSION == 0:
            child.reset_daily_distress()
            trial_in_session = 0

        arms = policy.choose_arms()
        log.activities.append(ActivityRecord(activity_index=activity_index, arms=arms))

        for _ in range(ITEMS_PER_ACTIVITY):
            mastery = learner.get_mastery(child_id, topic).p
            if child.should_abandon():
                optimal_p = child.optimal_p_correct(mastery=mastery, trial_in_session=trial_in_session)
                log.trials.append(TrialRecord(activity_index=activity_index, correct=None, optimal_p=optimal_p, actual_p=0.0, abandoned=True))
                log.distress_trajectory.append(child.true_distress)
                break
            correct, _rt = child.answer(
                method=arms["teaching_method"], modality=arms["modality"], theme=arms["theme"],
                mastery=mastery, trial_in_session=trial_in_session,
            )
            actual_p = child.p_correct(
                method=arms["teaching_method"], modality=arms["modality"], theme=arms["theme"],
                mastery=mastery, trial_in_session=trial_in_session,
            )
            optimal_p = child.optimal_p_correct(mastery=mastery, trial_in_session=trial_in_session)
            learner.update(child_id, topic, correct)
            retention.update(child_id, topic, correct)
            policy.record_outcome(arms, correct)
            child.update_distress(correct=correct, method=arms["teaching_method"], modality=arms["modality"], theme=arms["theme"])
            log.trials.append(TrialRecord(
                activity_index=activity_index, correct=correct, optimal_p=optimal_p, actual_p=actual_p,
                mastery_after=learner.get_mastery(child_id, topic).p,
            ))
            log.distress_trajectory.append(child.true_distress)
            trial_in_session += 1
        db.commit()

    return log, db, child_id, topic
