"""
DecisionEngine ⭐ — combines every module's output into one ActivitySpec.
Mirrors the pseudocode in docs/ARCHITECTURE.md §3 exactly:

    topic = SessionPlanner.next_topic(state)          # deterministic, never randomized
    for axis in active_axes:
        if locked:                use the locked arm
        elif distress rising:     use the safest known arm
        elif a winner exists:     exploit it
        else:                     explore (Thompson sampling)
    return ActivitySpec(...)

Thompson sampling is the actual explore/exploit mechanism, not a placeholder:
each arm's Beta posterior (population prior + this child's own evidence) is
sampled once, and the highest sample wins. A confident child-specific
posterior wins almost every time; an uncertain one still gets explored.
"""
import random
from dataclasses import dataclass

from sqlalchemy.orm import Session as DBSession

from app.engine.difficulty_model import DifficultyModel, RecentPerformance
from app.engine.effect_estimator import EffectEstimator
from app.engine.experiment_manager import ArmChoice, ExperimentManager
from app.engine.learner_model import LearnerModel
from app.engine.retention_model import RetentionModel
from app.engine.safety import DistressMonitor, TherapistLocks
from app.engine.session_planner import SessionPlanner
from app.models.curriculum import ActivityTemplate, Item, ItemSet

DEFAULT_THEME_CODE = "dino"  # placeholder until InterestModel + theme axis land (docs/PLAN.md Phase 7)


@dataclass
class ActivitySpec:
    topic_id: str
    topic_code: str
    topic_reason: str
    difficulty: int
    method_arm: ArmChoice
    modality_arm: ArmChoice
    theme_code: str
    item_set_id: str | None
    items: list[dict]
    probe_ids: list[str]  # ScheduledProbe rows this activity fulfills, if any (docs/PLAN.md Phase 5)


class DecisionEngine:
    def __init__(self, db: DBSession, random_seed: int | None = None):
        self.db = db
        self.planner = SessionPlanner(db)
        self.learner_model = LearnerModel(db)
        self.difficulty_model = DifficultyModel()
        self.experiments = ExperimentManager(db, random_seed=random_seed)
        self.effects = EffectEstimator(db)
        self.retention_model = RetentionModel(db)
        self.locks = TherapistLocks(db)
        self.distress = DistressMonitor()
        self._rng = random.Random(random_seed)

    def _choose_arm(self, child_id: str, axis, distress_level: float) -> ArmChoice:
        all_arms = self.experiments.arms_for(axis.id)
        all_arm_ids = [a.id for a in all_arms]
        allowed_ids = self.locks.allowed_arms(child_id, axis.id, all_arm_ids)

        if not allowed_ids:
            # everything blocked -> fall back to the axis's declared safe default
            safe = next((a for a in all_arms if a.is_safe_default), all_arms[0])
            return ArmChoice(
                axis_id=axis.id, axis_code=axis.code, arm_id=safe.id, arm_code=safe.code,
                decision_type="safe_fallback", reason="all arms locked", candidate_arm_ids=all_arm_ids,
            )

        if distress_level >= self.distress.RISING_THRESHOLD:
            safe = next((a for a in all_arms if a.id in allowed_ids and a.is_safe_default), None)
            safe = safe or next(a for a in all_arms if a.id in allowed_ids)
            return ArmChoice(
                axis_id=axis.id, axis_code=axis.code, arm_id=safe.id, arm_code=safe.code,
                decision_type="safe_fallback", reason="distress rising", candidate_arm_ids=allowed_ids,
            )

        verdict = self.effects.winner(child_id, axis.id, allowed_ids)
        if verdict is not None:
            arm = next(a for a in all_arms if a.id == verdict.arm_id)
            return ArmChoice(
                axis_id=axis.id, axis_code=axis.code, arm_id=arm.id, arm_code=arm.code,
                decision_type="exploit", reason=f"confirmed winner (n={verdict.evidence_trials})",
                candidate_arm_ids=allowed_ids,
            )

        # Thompson sampling: draw once from each allowed arm's posterior, take the max.
        samples = []
        for arm_id in allowed_ids:
            post = self.effects.posterior(child_id, axis.id, arm_id)
            # Beta sample via mean/sd moment-matched approximation is overkill here;
            # sample from a Beta(alpha,beta) reconstructed from mean/n directly.
            alpha = max(post.mean * post.n, 0.5) + self.effects.population_alpha
            beta = max((1 - post.mean) * post.n, 0.5) + self.effects.population_beta
            samples.append((arm_id, self._rng.betavariate(alpha, beta)))
        best_arm_id = max(samples, key=lambda pair: pair[1])[0]
        arm = next(a for a in all_arms if a.id == best_arm_id)
        return ArmChoice(
            axis_id=axis.id, axis_code=axis.code, arm_id=arm.id, arm_code=arm.code,
            decision_type="explore", reason="no confirmed winner yet (Thompson sampling)",
            candidate_arm_ids=allowed_ids,
        )

    def decide(self, child_id: str) -> ActivitySpec:
        topic_choice = self.planner.next_topic(child_id)
        mastery = self.learner_model.get_mastery(child_id, topic_choice.topic_id)

        # Phase 1 stand-in for real distress signal; EngagementModel (Phase 6) replaces this.
        distress_level = 0.0

        axes = self.experiments.active_axes()
        arm_choices: dict[str, ArmChoice] = {}
        for axis in axes:
            choice = self._choose_arm(child_id, axis, distress_level)
            posterior_snapshot = {
                arm_id: vars(self.effects.posterior(child_id, axis.id, arm_id))
                for arm_id in choice.candidate_arm_ids
            }
            self.experiments.record_assignment(
                db_child_id=child_id,
                choice=choice,
                seed=self.experiments.random_seed_value(),
                posterior_snapshot=posterior_snapshot,
                distress_level=distress_level,
            )
            arm_choices[axis.code] = choice

        template = (
            self.db.query(ActivityTemplate).filter_by(topic_id=topic_choice.topic_id).first()
        )
        difficulty = self.difficulty_model.next_level(
            current_level=1,
            recent=RecentPerformance(accuracy=mastery.p, avg_response_time_ms=4000, avg_attempts=1, n=mastery.n_trials),
        )

        # If this topic is due for revision, prefer the exact item set a
        # pending probe was scheduled against — testing recall of the SAME
        # material that was taught, rather than a fresh random pick, which
        # would confound "did they retain it" with "is this just easier"
        # (docs/PLAN.md Phase 5). Audit probes (delay_days=0) carry no
        # item_set_id by design (README §13: a spot-check on the topic in
        # general, not tied to one teaching decision) and fall through to a
        # normal random matched set.
        due_probes = self.retention_model.due_probes_for_topic(child_id, topic_choice.topic_id)
        probe_item_set_id = next((p.item_set_id for p in due_probes if p.item_set_id), None)

        if probe_item_set_id is not None:
            item_set = self.db.query(ItemSet).filter_by(id=probe_item_set_id).one_or_none()
        else:
            item_set = self.experiments.matched_item_set(topic_choice.topic_id, theme_id=None)

        items = []
        if item_set is not None:
            rows = self.db.query(Item).filter_by(item_set_id=item_set.id).all()
            items = [{"id": i.id, "answer": i.answer, "distractors": i.distractors} for i in rows]

        return ActivitySpec(
            topic_id=topic_choice.topic_id,
            topic_code=topic_choice.topic_code,
            topic_reason=topic_choice.reason,
            difficulty=difficulty,
            method_arm=arm_choices.get("teaching_method"),
            modality_arm=arm_choices.get("modality"),
            theme_code=DEFAULT_THEME_CODE,
            item_set_id=item_set.id if item_set else None,
            items=items,
            probe_ids=[p.id for p in due_probes],
        )
