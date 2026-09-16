"""
research/ — Phase 8 evaluation (docs/PLAN.md): child simulator, baseline
policies, the ablation study, and the single-case replay harness.

Every module here drives the REAL backend engine (app.engine.*, app.services.*)
directly against a throwaway in-memory SQLite database, matching
docs/ARCHITECTURE.md §3 ("tested against the simulator in research/ without a
server" — no HTTP, no Docker; still a real SQLAlchemy session, since the engine
modules are DB-backed by design). This is deliberate: the "AURA" condition in
every study is the literal production DecisionEngine, not a re-implementation,
so a result here is a claim about the actual shipped system.

Run scripts from the repo root with the backend's own virtualenv, e.g.:

    backend/.venv/bin/python -m research.run_simulation_study
"""
import sys
from pathlib import Path

_BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))
