"""
Seed the database with the Phase 2 vertical-slice content:

- 6 curriculum domains (README §4), with one real topic (Numbers 1-5) fleshed out
- 4 interest themes (README §5)
- matched item sets for Numbers 1-5, so the experiment axes have something
  legitimate to compare from day one (docs/SCHEMA.md §3 — item_sets)
- the axes + arms this prototype starts with (docs/ARCHITECTURE.md §3)

Run with:  backend/.venv/bin/python -m scripts.seed
Safe to re-run: it wipes and recreates (dev-only convenience).
"""
from app.db import Base, SessionLocal, engine, init_db
from app.models.curriculum import ActivityTemplate, Domain, Guide, Item, ItemSet, Theme, Topic
from app.models.experiment import Arm, Axis

DOMAINS = [
    ("literacy", "Foundational Literacy", 1),
    ("numeracy", "Foundational Numeracy", 2),
    ("communication", "Communication & Language", 3),
    ("cognitive", "Cognitive & Problem-Solving Skills", 4),
    ("social_emotional", "Social, Emotional & Self-Regulation", 5),
    ("functional", "Functional / Daily-Life Learning", 6),
]

THEMES = [
    ("dino", "Dinosaurs", "themes/dino", "Rex", "living"),
    ("space", "Space", "themes/space", "Astro", "non_living"),
    ("ocean", "Ocean", "themes/ocean", "Splash", "living"),
    ("cars", "Cars", "themes/cars", "Turbo", "non_living"),
]

AXES = [
    ("teaching_method", "How new items are taught", ["errorless", "try_then_correct"]),
    ("modality", "How the child responds", ["tap", "drag_drop"]),
]

# Not in ACTIVE_AXIS_CODES (app/engine/experiment_manager.py) — this one is
# NOT assigned on every lesson activity like the axes above. It's only
# triggered conditionally, when EngagementModel detects declining engagement
# (docs/PLAN.md Phase 6 / README §16). Same Thompson-sampling machinery,
# different trigger.
INTERVENTION_AXIS = ("intervention", "Which support helps them re-engage", ["mini_game", "interest_injection", "modality_switch", "break"])
SAFE_DEFAULT_ARMS = {"try_then_correct", "tap", "break"}


def seed() -> None:
    Base.metadata.drop_all(bind=engine)
    init_db()
    db = SessionLocal()
    try:
        domains = {}
        for code, label, order in DOMAINS:
            d = Domain(code=code, label=label, sort_order=order)
            db.add(d)
            domains[code] = d
        db.flush()

        themes = {}
        for code, label, asset_path, guide_name, char_type in THEMES:
            t = Theme(code=code, label=label, asset_path=asset_path)
            db.add(t)
            db.flush()
            db.add(Guide(theme_id=t.id, name=guide_name, character_type=char_type))
            themes[code] = t
        db.flush()

        axes = {}
        for code, label, arm_codes in [*AXES, INTERVENTION_AXIS]:
            axis = Axis(code=code, label=label, active_default=(code != INTERVENTION_AXIS[0]))
            db.add(axis)
            db.flush()
            for arm_code in arm_codes:
                db.add(
                    Arm(
                        axis_id=axis.id,
                        code=arm_code,
                        label=arm_code.replace("_", " ").title(),
                        is_safe_default=(arm_code in SAFE_DEFAULT_ARMS),
                    )
                )
            axes[code] = axis
        db.flush()

        numbers_topic = Topic(
            domain_id=domains["numeracy"].id,
            code="num_1_5",
            label="Numbers 1-5",
            level="beginner",
            prerequisites=[],
        )
        db.add(numbers_topic)
        db.flush()

        db.add(
            ActivityTemplate(
                topic_id=numbers_topic.id,
                modality="drag_drop",
                method_compatible=["errorless", "try_then_correct"],
                difficulty_min=1,
                difficulty_max=3,
                config={"kind": "count_and_select"},
            )
        )
        db.add(
            ActivityTemplate(
                topic_id=numbers_topic.id,
                modality="tap",
                method_compatible=["errorless", "try_then_correct"],
                difficulty_min=1,
                difficulty_max=3,
                config={"kind": "tap_the_number"},
            )
        )

        # Two matched item sets so a theme comparison (dino vs space) is
        # legitimate from day one: same size, same difficulty mean, same
        # answers -- only the theme differs. See docs/SCHEMA.md §3.
        for theme_code in ("dino", "space"):
            item_set = ItemSet(
                topic_id=numbers_topic.id,
                match_group="num_1_5_intro_v1",
                difficulty_mean=1.4,
                size=5,
            )
            db.add(item_set)
            db.flush()
            for answer in (1, 2, 3, 4, 5):
                db.add(
                    Item(
                        topic_id=numbers_topic.id,
                        item_set_id=item_set.id,
                        difficulty=1 if answer <= 3 else 2,
                        answer={"count": answer},
                        distractors=[answer - 1, answer + 1] if 1 < answer < 5 else [answer + 1],
                        theme_id=themes[theme_code].id,
                        source="authored",
                        review_status="approved",
                    )
                )

        db.commit()
        print("Seed complete:")
        print(f"  domains: {len(DOMAINS)}")
        print(f"  themes:  {len(THEMES)}")
        print(f"  axes:    {[a[0] for a in AXES]} + intervention (conditional)")
        print("  topic:   num_1_5 with 2 matched item sets (dino / space), 5 items each")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
