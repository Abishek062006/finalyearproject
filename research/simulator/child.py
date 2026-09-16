"""
SimulatedChild — a hidden ground-truth answering/distress model (docs/PLAN.md
Phase 8: "simulated learners whose best method differs, some distressed by
errors, some with fast forgetting").

What "grounded in the published findings" means here, honestly: the
qualitative STRUCTURE of this population is what README §2's evidence section
reports —
  - different children genuinely have opposite best arms (Majdalany et al.
    2014; Haq & Kodak 2015 found opposite winners for massed vs distributed
    practice across children),
  - effect sizes are idiosyncratic per child, including some children with
    close to no real preference at all (Kodak et al. 2016's "idiosyncratic"
    error-correction responses),
  - some children are far more distress-prone than others.
The specific NUMERIC ranges below are not fitted to any single published
effect size — no public per-child teaching-method dataset exists to fit
against (README §4: "does not exist" is literally the gap this simulation is
built to work around). Confronting the model with real published numbers is
the replay study's job (research/replay/), not this simulator's.

Mastery itself is NOT modelled here — it's read from the real LearnerModel
(the shared measurement instrument every condition in the study uses
identically) and fed in as `mastery` on each call, so only the "which arm
was used" decision differs between conditions, not how learning is measured.
"""
import random
from dataclasses import dataclass, field

METHOD_ARMS = ["errorless", "try_then_correct"]
MODALITY_ARMS = ["tap", "drag_drop"]
THEME_ARMS = ["dino", "space", "ocean", "cars"]
INTERVENTION_ARMS = ["mini_game", "interest_injection", "modality_switch", "break"]

FATIGUE_PER_TRIAL = 0.006  # small within-session attention decay
FATIGUE_CAP_TRIALS = 12
DISTRESS_PERFORMANCE_PENALTY = 0.18  # a distressed child also performs worse, not just "feels bad"
ABANDON_SCALE = 0.22  # even at true_distress=1.0, abandonment per item is a probability, not a certainty


@dataclass
class SimulatedChild:
    child_index: int
    true_best_method: str
    true_best_modality: str
    true_best_theme: str
    true_best_intervention: str
    base_ability: float
    learning_rate: float
    method_effect: float
    modality_effect: float
    theme_effect: float
    distress_proneness: float
    intervention_relief_best: float
    intervention_relief_other: float
    rng: random.Random
    true_distress: float = field(default=0.0)

    def p_correct(self, *, method: str | None, modality: str | None, theme: str | None, mastery: float, trial_in_session: int) -> float:
        p = self.base_ability
        p += self.learning_rate * mastery
        if method is not None:
            p += self.method_effect if method == self.true_best_method else 0.0
        if modality is not None:
            p += self.modality_effect if modality == self.true_best_modality else 0.0
        if theme is not None:
            p += self.theme_effect if theme == self.true_best_theme else 0.0
        p -= FATIGUE_PER_TRIAL * min(trial_in_session, FATIGUE_CAP_TRIALS)
        p -= DISTRESS_PERFORMANCE_PENALTY * self.true_distress
        return min(0.97, max(0.03, p))

    def response_time_ms(self, *, p: float) -> int:
        base = 2200 + 1800 * (1 - p) + self.true_distress * 1500
        noise = self.rng.gauss(0, 350)
        return max(400, round(base + noise))

    def answer(self, *, method: str | None, modality: str | None, theme: str | None, mastery: float, trial_in_session: int) -> tuple[bool, int]:
        p = self.p_correct(method=method, modality=modality, theme=theme, mastery=mastery, trial_in_session=trial_in_session)
        correct = self.rng.random() < p
        return correct, self.response_time_ms(p=p)

    def optimal_p_correct(self, *, mastery: float, trial_in_session: int) -> float:
        """The best this child could possibly do this trial, given their OWN
        true-best arms — the reference point cumulative regret is measured
        against. Only computable because we (the evaluator) wrote the ground
        truth; no real system gets to see this."""
        return self.p_correct(
            method=self.true_best_method, modality=self.true_best_modality, theme=self.true_best_theme,
            mastery=mastery, trial_in_session=trial_in_session,
        )

    def update_distress(self, *, correct: bool, method: str | None, modality: str | None, theme: str | None) -> None:
        mismatches = [
            method is not None and method != self.true_best_method,
            modality is not None and modality != self.true_best_modality,
            theme is not None and theme != self.true_best_theme,
        ]
        mismatch_frac = sum(mismatches) / max(1, len(mismatches))
        if correct:
            delta = -0.10
        else:
            delta = 0.08 + 0.20 * mismatch_frac
        delta *= 0.3 + 0.7 * self.distress_proneness
        self.true_distress = min(1.0, max(0.0, self.true_distress + delta))

    def apply_intervention_relief(self, intervention_arm_code: str | None) -> None:
        if intervention_arm_code is None:
            return
        relief = self.intervention_relief_best if intervention_arm_code == self.true_best_intervention else self.intervention_relief_other
        self.true_distress = max(0.0, self.true_distress * (1 - relief))

    def should_abandon(self) -> bool:
        return self.rng.random() < self.true_distress * ABANDON_SCALE

    def clone_for_condition(self, seed: int) -> "SimulatedChild":
        """The SAME ground truth (true best arms, effect sizes, ability,
        distress proneness) with a FRESH independent rng stream and
        true_distress reset to 0 — one clone per condition a child is run
        through. Without this, conditions run later in a loop would silently
        inherit the previous condition's leftover rng position and
        end-of-run distress level, contaminating the comparison (caught by
        a smoke test: the same `child` object reused across static/
        heuristic/expert baselines gave wildly different retention/
        abandonment despite supposedly facing "the same" simulated child)."""
        return SimulatedChild(
            child_index=self.child_index,
            true_best_method=self.true_best_method,
            true_best_modality=self.true_best_modality,
            true_best_theme=self.true_best_theme,
            true_best_intervention=self.true_best_intervention,
            base_ability=self.base_ability,
            learning_rate=self.learning_rate,
            method_effect=self.method_effect,
            modality_effect=self.modality_effect,
            theme_effect=self.theme_effect,
            distress_proneness=self.distress_proneness,
            intervention_relief_best=self.intervention_relief_best,
            intervention_relief_other=self.intervention_relief_other,
            rng=random.Random(seed),
            true_distress=0.0,
        )

    def reset_daily_distress(self) -> None:
        """A new session is a fresh start, not a continuation of yesterday's
        frustration — matches the product's own per-session EngagementModel
        window (app/engine/engagement_model.py), which never looks across
        session boundaries either."""
        self.true_distress *= 0.4


def generate_population(n: int, seed: int = 0) -> list[SimulatedChild]:
    rng = random.Random(seed)
    children = []
    for i in range(n):
        children.append(
            SimulatedChild(
                child_index=i,
                true_best_method=rng.choice(METHOD_ARMS),
                true_best_modality=rng.choice(MODALITY_ARMS),
                true_best_theme=rng.choice(THEME_ARMS),
                true_best_intervention=rng.choice(INTERVENTION_ARMS),
                base_ability=rng.uniform(0.30, 0.55),
                learning_rate=rng.uniform(0.25, 0.45),
                method_effect=rng.uniform(0.08, 0.30),
                modality_effect=rng.uniform(0.05, 0.25),
                theme_effect=rng.uniform(0.0, 0.20),  # honestly: some children have ~no real theme preference
                distress_proneness=rng.uniform(0.0, 1.0),
                intervention_relief_best=rng.uniform(0.5, 0.8),
                intervention_relief_other=rng.uniform(0.15, 0.4),
                rng=random.Random(seed * 1_000_003 + i),
            )
        )
    return children
