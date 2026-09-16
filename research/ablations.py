"""
The ablation study's 4 conditions (docs/PLAN.md Phase 8: "remove hierarchical
prior / early predictor / safety layer / randomization"). Each is a small
DecisionEngine subclass used ONLY by research/run_ablation_study.py — none of
this touches app/engine directly, so the shipped product is unaffected.

Every subclass changes exactly ONE mechanism, leaving the rest of the real
engine (topic selection, item matching, content bank, everything else)
untouched, so a difference in the study's metrics can be attributed to that
one design choice.
"""
from app.engine.decision_engine import DecisionEngine
from app.engine.effect_estimator import EffectEstimator
from app.engine.experiment_manager import ArmChoice


class NoHierarchicalPriorEngine(DecisionEngine):
    """README §2, contribution 2: no pooled prior shared across children —
    population_alpha/beta near zero, so a new child's posterior starts from
    almost nothing instead of a weakly-informative population belief
    (docs/PLAN.md Phase 4's "hierarchical prior shared across children
    (cold start)")."""

    def __init__(self, db, random_seed: int | None = None):
        super().__init__(db, random_seed=random_seed)
        self.effects = EffectEstimator(db, population_alpha=0.02, population_beta=0.02)


class NoSafetyLayerEngine(DecisionEngine):
    """README §2, contribution 2a: the distress budget never pauses
    exploration — RISING_THRESHOLD raised out of reach so choose_arm's
    safe_fallback-on-distress branch can never fire. Locks (therapist
    overrides) are untouched; this ablates only the AUTOMATIC safety
    response to a child's own rising distress signal."""

    def __init__(self, db, random_seed: int | None = None):
        super().__init__(db, random_seed=random_seed)
        self.distress.RISING_THRESHOLD = float("inf")


class NoEarlyPredictorEngine(DecisionEngine):
    """README §2, contribution 2c: lesson axes may only declare a winner
    from delayed retention_7d outcomes (which take a week to accumulate),
    never from same-day "immediate" correctness — removing the fast leading
    indicator that lets AURA "end comparisons in days, not weeks". Only
    touches calls that used the DEFAULT outcome_kind ("immediate", i.e. the
    3 lesson axes); the intervention axis's own explicit "engagement_60s"
    judgement is untouched, since that's a different mechanism."""

    def choose_arm(self, child_id, axis, distress_level, outcome_kind: str = "immediate") -> ArmChoice:
        if outcome_kind == "immediate":
            outcome_kind = "retention_7d"
        return super().choose_arm(child_id, axis, distress_level, outcome_kind=outcome_kind)


class NoRandomizationEngine(DecisionEngine):
    """README §2, contribution 2 (the core mechanism): replaces Thompson
    sampling's random posterior draw with a deterministic argmax of the
    posterior mean — no randomized exploration step at all, so an early run
    of luck on one arm can permanently look like the better arm, exactly the
    confound randomized assignment exists to prevent. Mirrors
    DecisionEngine.choose_arm's own branch structure (locked / distress /
    confirmed winner) exactly; only the final "no confirmed winner yet"
    branch differs from the real engine."""

    def choose_arm(self, child_id, axis, distress_level, outcome_kind: str = "immediate") -> ArmChoice:
        all_arms = self.experiments.arms_for(axis.id)
        all_arm_ids = [a.id for a in all_arms]
        allowed_ids = self.locks.allowed_arms(child_id, axis.id, all_arm_ids)

        if not allowed_ids:
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

        verdict = self.effects.winner(child_id, axis.id, allowed_ids, kind=outcome_kind)
        if verdict is not None:
            arm = next(a for a in all_arms if a.id == verdict.arm_id)
            return ArmChoice(
                axis_id=axis.id, axis_code=axis.code, arm_id=arm.id, arm_code=arm.code,
                decision_type="exploit", reason=f"confirmed winner (n={verdict.evidence_trials})",
                candidate_arm_ids=allowed_ids,
            )

        # The ablated step: greedy argmax of the posterior MEAN, no Beta
        # sample, no exploration.
        best_arm_id = max(
            allowed_ids, key=lambda arm_id: self.effects.posterior(child_id, axis.id, arm_id, kind=outcome_kind).mean
        )
        arm = next(a for a in all_arms if a.id == best_arm_id)
        return ArmChoice(
            axis_id=axis.id, axis_code=axis.code, arm_id=arm.id, arm_code=arm.code,
            decision_type="explore", reason="no confirmed winner yet (greedy — randomization ablated)",
            candidate_arm_ids=allowed_ids,
        )


ABLATION_ENGINES: dict[str, type[DecisionEngine]] = {
    "full_aura": DecisionEngine,
    "no_hierarchical_prior": NoHierarchicalPriorEngine,
    "no_safety_layer": NoSafetyLayerEngine,
    "no_early_predictor": NoEarlyPredictorEngine,
    "no_randomization": NoRandomizationEngine,
}
