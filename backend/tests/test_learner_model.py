"""
Regression test for a real bug found while building Phase 5 (retention audit
probes never fired because mastery could never cross the threshold): the
alpha/beta reconstruction in LearnerModel.update() had an exact fixed point
at mean=0.6 for any number of consecutive correct answers. See the fix's
comment in app/engine/learner_model.py for the derivation.
"""
from app.engine.learner_model import LearnerModel


def test_mastery_keeps_climbing_toward_1_with_many_correct_answers(seeded_db, child_id):
    lm = LearnerModel(seeded_db)
    means = [lm.update(child_id, "topicA", correct=True).p for _ in range(20)]

    # Strictly increasing, not flatlined at any point (the bug's exact
    # symptom: every mean after the first update equaled 0.6).
    assert all(b > a for a, b in zip(means, means[1:]))
    assert means[-1] > 0.9


def test_mastery_responds_sensibly_to_a_mixed_sequence(seeded_db, child_id):
    lm = LearnerModel(seeded_db)
    sequence = [True, True, False, True, True, True, False, True, True, True]
    means = [lm.update(child_id, "topicB", correct=c).p for c in sequence]

    # A failure should always pull the estimate down from whatever it just was.
    for i, correct in enumerate(sequence):
        if i == 0:
            continue
        if correct:
            assert means[i] > means[i - 1]
        else:
            assert means[i] < means[i - 1]

    # Matches the closed-form Beta-Bernoulli posterior mean exactly:
    # (prior_alpha + successes) / (prior_alpha + prior_beta + n).
    successes = sum(sequence)
    expected = (2.0 + successes) / (2.0 + 2.0 + len(sequence))
    assert abs(means[-1] - expected) < 1e-9
