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
    # docs/PLAN.md Phase 7: interest becomes a REAL randomized-comparison
    # axis instead of a static default inferred from click counts (README
    # §6/§7) — arm codes are theme codes, so a chosen arm maps straight to
    # a Theme row via matching `code`.
    ("theme", "Which interest theme is shown", [t[0] for t in THEMES]),
]

# Not in ACTIVE_AXIS_CODES (app/engine/experiment_manager.py) — this one is
# NOT assigned on every lesson activity like the axes above. It's only
# triggered conditionally, when EngagementModel detects declining engagement
# (docs/PLAN.md Phase 6 / README §16). Same Thompson-sampling machinery,
# different trigger.
INTERVENTION_AXIS = ("intervention", "Which support helps them re-engage", ["mini_game", "interest_injection", "modality_switch", "break"])
SAFE_DEFAULT_ARMS = {"try_then_correct", "tap", "break", "dino"}


LETTERS = ["A", "B", "C", "D", "E"]

# Plan Phase 5. Feelings are shown as the learning friends' own expressions
# (app/src/companion/FeelingFace.tsx); these codes are the buddy moods.
FEELINGS = ["happy", "sad", "angry", "scared", "surprised"]

# Everyday routines. Each has five real steps; a step's number is the lowest
# difficulty level that includes it, so level 1 practises the 3 key steps,
# level 2 four, level 3 all five — and every level can serve any routine, so
# a child isn't handed the same one over and over. Pictures are emoji: they
# show the actual object (a toothbrush, not a paintbrush), which matters for
# children who read pictures literally. The app's step-by-step guide
# (app/src/child/routines.ts) uses the same steps — keep them in sync.
ROUTINES = {
    "wash_hands": ("Washing hands", [("Turn on the tap", "🚰", 2), ("Wet your hands", "💧", 1), ("Use soap", "🧼", 1), ("Rinse the soap off", "💦", 3), ("Dry your hands", "👐", 1)]),
    "brush_teeth": ("Brushing teeth", [("Put toothpaste on", "🪥", 1), ("Brush all your teeth", "🦷", 1), ("Spit it out", "💦", 1), ("Rinse your mouth", "🥛", 3), ("Rinse the brush", "🚰", 2)]),
    "get_dressed": ("Getting dressed", [("Pants on", "👖", 1), ("Shirt on", "👕", 1), ("Socks on", "🧦", 2), ("Shoes on", "👟", 1), ("Coat on", "🧥", 3)]),
}
DIFFICULTY_LEVELS = (1, 2, 3)


def _distractors(answer: int, offsets: tuple[int, ...], n: int) -> list[int]:
    """Up to n distinct counts near `answer` (in offset order), kept inside 1-5."""
    out: list[int] = []
    for d in offsets:
        v = answer + d
        if 1 <= v <= 5 and v != answer and v not in out:
            out.append(v)
        if len(out) == n:
            break
    return out


def leveled_items(kind: str, level: int) -> list[dict]:
    """What one item set holds at each difficulty level (DifficultyModel's
    1-3). Counting and letter sets keep 5 items at every level, so a level
    change never changes how much practice an activity gives — only how hard
    each item is (fewer/closer choices). Board activities grow instead."""
    if kind == "counting":
        if level == 1:  # small counts, one far-off choice
            return [{"count": a, "distractors": _distractors(a, (2, -2, 3), 1)} for a in (1, 2, 3, 2, 3)]
        if level == 2:  # the full 1-5 range, neighbouring choices
            return [{"count": a, "distractors": _distractors(a, (1, -1, 2, -2), 2)} for a in (1, 2, 3, 4, 5)]
        return [{"count": a, "distractors": _distractors(a, (1, -1, 2, -2, 3, -3), 3)} for a in (3, 4, 5, 4, 5)]
    if kind == "letter_identify":
        pool = LETTERS[:3] if level == 1 else LETTERS
        targets = ["A", "B", "C", "A", "B"] if level == 1 else LETTERS
        # level 1 = one other letter, 2 = two, 3 = three; nearest letters first
        return [
            {"label": t, "distractors": sorted((l for l in pool if l != t), key=lambda l: abs(ord(l) - ord(t)))[:level]}
            for t in targets
        ]
    if kind == "matching":
        return [{"label": l, "distractors": []} for l in LETTERS[: level + 2]]
    if kind == "emotion_identify":
        # level 1: happy vs sad; 2: + angry, scared; 3: all five, three wrong faces
        pool = FEELINGS[: (2, 4, 5)[level - 1]]
        targets = [pool[i % len(pool)] for i in range(5)]
        return [{"label": t, "distractors": [f for f in pool if f != t][:level]} for t in targets]
    if kind == "routine_order":
        raise ValueError("routine_order has one item set per routine — use routine_items(code, level)")
    if kind == "sequencing":
        return [{"value": v, "position": v - 1} for v in range(1, level + 3)]
    raise ValueError(kind)


def routine_items(code: str, level: int) -> list[dict]:
    name, steps = ROUTINES[code]
    shown = [(label, pic) for label, pic, min_level in steps if min_level <= level]
    return [
        {"value": i + 1, "position": i, "label": label, "icon": pic, "routine": code, "routine_label": name}
        for i, (label, pic) in enumerate(shown)
    ]


def _add_leveled_item_sets(db, topic, kind: str, themes: dict) -> None:
    """One matched item set per theme AND difficulty level. Within a level,
    the four theme sets share a match_group (same size, same answers, only
    the theme differs), so the theme axis stays a fair randomized comparison
    (docs/SCHEMA.md §3) whatever level a child is working at."""
    for level in DIFFICULTY_LEVELS:
        # Routines: one set per routine at every level (same size within a level).
        variants = [routine_items(code, level) for code in ROUTINES] if kind == "routine_order" else [leveled_items(kind, level)]
        for specs, (theme_code, *_) in ((v, t) for v in variants for t in THEMES):
            item_set = ItemSet(topic_id=topic.id, match_group=f"{topic.code}_L{level}_v2", difficulty_mean=float(level), size=len(specs))
            db.add(item_set)
            db.flush()
            for spec in specs:
                if kind == "counting":
                    answer, distractors = {"count": spec["count"]}, spec["distractors"]
                elif kind in ("letter_identify", "matching", "emotion_identify"):
                    answer, distractors = {"label": spec["label"]}, spec["distractors"]
                elif kind == "routine_order":
                    answer, distractors = {k: spec[k] for k in ("value", "position", "label", "icon", "routine", "routine_label")}, []
                else:
                    answer, distractors = {"value": spec["value"], "position": spec["position"]}, []
                db.add(
                    Item(
                        topic_id=topic.id,
                        item_set_id=item_set.id,
                        difficulty=level,
                        answer=answer,
                        distractors=distractors,
                        theme_id=themes[theme_code].id,
                        source="authored",
                        review_status="approved",
                    )
                )


def seed_curriculum(db) -> None:
    """The actual curriculum-building logic, factored out so it can run
    against ANY SQLAlchemy session — the real dev DB (below), the pytest
    in-memory fixture (tests/conftest.py), or a research/ simulation's own
    throwaway in-memory DB (docs/PLAN.md Phase 8) — without three copies of
    this drifting apart. Does not commit; the caller owns the transaction."""
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

    # `config.activity_kind` tells DecisionEngine/the frontend what KIND of
    # activity this topic's items are — "counting" here — as opposed to
    # letter_identify, matching, etc. (docs/PLAN.md's content-breadth
    # follow-up). Both modality variants of the same topic share the same
    # activity_kind, since it describes the CONTENT, not the response
    # mechanism, and DecisionEngine just reads whichever template row it
    # gets first for a topic.
    db.add(
        ActivityTemplate(
            topic_id=numbers_topic.id,
            modality="drag_drop",
            method_compatible=["errorless", "try_then_correct"],
            difficulty_min=1,
            difficulty_max=3,
            config={"activity_kind": "counting"},
        )
    )
    db.add(
        ActivityTemplate(
            topic_id=numbers_topic.id,
            modality="tap",
            method_compatible=["errorless", "try_then_correct"],
            difficulty_min=1,
            difficulty_max=3,
            config={"activity_kind": "counting"},
        )
    )

    _add_leveled_item_sets(db, numbers_topic, "counting", themes)

    # Second topic, second domain, second activity kind (docs/PLAN.md's
    # content-breadth follow-up: only Numeracy had real content before this).
    # Letters A-E, matching the "Numbers 1-5" scope precedent exactly.
    letters_topic = Topic(
        domain_id=domains["literacy"].id,
        code="letters_a_e",
        label="Letter recognition (A-E)",
        level="beginner",
        prerequisites=[],
    )
    db.add(letters_topic)
    db.flush()

    for modality in ("drag_drop", "tap"):
        db.add(
            ActivityTemplate(
                topic_id=letters_topic.id,
                modality=modality,
                method_compatible=["errorless", "try_then_correct"],
                difficulty_min=1,
                difficulty_max=3,
                config={"activity_kind": "letter_identify"},
            )
        )

    _add_leveled_item_sets(db, letters_topic, "letter_identify", themes)
    db.flush()

    # Third topic, third activity kind (docs/PLAN.md Phase B: matching):
    # NOT a new content domain — it reuses the exact same letters A-E as
    # letters_a_e above, just answered as a whole-board matching puzzle
    # (letter -> picture) instead of one tap-choice at a time. Kept as its
    # own Topic (rather than a second ActivityTemplate on letters_a_e)
    # because activity_kind is read from whichever template row a topic's
    # `.first()` happens to return (decision_engine.py) — mixing kinds on
    # one topic would make that non-deterministic.
    letters_match_topic = Topic(
        domain_id=domains["literacy"].id,
        code="letters_a_e_match",
        label="Letter-picture matching (A-E)",
        level="beginner",
        prerequisites=[],
    )
    db.add(letters_match_topic)
    db.flush()
    db.add(
        ActivityTemplate(
            topic_id=letters_match_topic.id,
            modality="tap",  # matching is always tap-to-pair; no drag_drop variant (README's modality axis doesn't apply here)
            method_compatible=["errorless", "try_then_correct"],
            difficulty_min=1,
            difficulty_max=3,
            config={"activity_kind": "matching"},
        )
    )
    _add_leveled_item_sets(db, letters_match_topic, "matching", themes)
    db.flush()

    # Fourth topic, fourth activity kind (docs/PLAN.md Phase B: sequencing).
    # Same "Numbers 1-5" scope as num_1_5, but answered by tapping tiles in
    # ascending order rather than picking one count out of a set of choices
    # — a genuinely different response paradigm, not a reskinned tap choice.
    numbers_sequence_topic = Topic(
        domain_id=domains["numeracy"].id,
        code="num_1_5_sequence",
        label="Ordering numbers 1-5",
        level="beginner",
        prerequisites=[],
    )
    db.add(numbers_sequence_topic)
    db.flush()
    db.add(
        ActivityTemplate(
            topic_id=numbers_sequence_topic.id,
            modality="tap",  # sequencing is always tap-to-place; no drag_drop variant
            method_compatible=["errorless", "try_then_correct"],
            difficulty_min=1,
            difficulty_max=3,
            config={"activity_kind": "sequencing"},
        )
    )
    _add_leveled_item_sets(db, numbers_sequence_topic, "sequencing", themes)
    db.flush()

    seed_life_skills_topics(db, domains, themes)


def seed_life_skills_topics(db, domains: dict, themes: dict) -> None:
    """Plan Phase 5: feelings and everyday routines, through the same engine.
    Separate so an existing dev database can gain these topics without being
    wiped (scripts/add_life_skills.py)."""
    feelings_topic = Topic(domain_id=domains["social_emotional"].id, code="feelings_basic", label="Recognising feelings", level="beginner", prerequisites=[])
    db.add(feelings_topic)
    db.flush()
    for modality in ("drag_drop", "tap"):
        db.add(
            ActivityTemplate(
                topic_id=feelings_topic.id, modality=modality, method_compatible=["errorless", "try_then_correct"],
                difficulty_min=1, difficulty_max=3, config={"activity_kind": "emotion_identify"},
            )
        )
    _add_leveled_item_sets(db, feelings_topic, "emotion_identify", themes)

    routines_topic = Topic(domain_id=domains["functional"].id, code="daily_routines", label="Everyday routines", level="beginner", prerequisites=[])
    db.add(routines_topic)
    db.flush()
    db.add(
        ActivityTemplate(
            topic_id=routines_topic.id, modality="tap", method_compatible=["errorless", "try_then_correct"],  # ordering is tap-to-place
            difficulty_min=1, difficulty_max=3, config={"activity_kind": "routine_order"},
        )
    )
    _add_leveled_item_sets(db, routines_topic, "routine_order", themes)
    db.flush()


def seed() -> None:
    Base.metadata.drop_all(bind=engine)
    init_db()
    db = SessionLocal()
    try:
        seed_curriculum(db)
        db.commit()
        print("Seed complete:")
        print(f"  domains: {len(DOMAINS)}")
        print(f"  themes:  {len(THEMES)}")
        print(f"  axes:    {[a[0] for a in AXES]} + intervention (conditional)")
        print(
            "  topics:  num_1_5 (counting) + letters_a_e (letter_identify) + "
            "letters_a_e_match (matching) + num_1_5_sequence (sequencing) + feelings_basic (emotion_identify) + "
            "daily_routines (routine_order), "
            f"{len(THEMES)} matched item sets per difficulty level ({len(DIFFICULTY_LEVELS)} levels) each"
        )
    finally:
        db.close()


if __name__ == "__main__":
    seed()
