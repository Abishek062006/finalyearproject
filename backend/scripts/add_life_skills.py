"""
Adds the plan Phase 5 topics (feelings, everyday routines) to an existing dev
database, keeping every account and child in it — unlike scripts.seed, which
wipes and recreates everything.

    backend/.venv/bin/python -m scripts.add_life_skills
"""
from app.db import SessionLocal
from app.models.curriculum import Domain, Theme, Topic
from scripts.seed import seed_life_skills_topics


def main() -> None:
    db = SessionLocal()
    try:
        if db.query(Topic).filter_by(code="feelings_basic").first():
            print("Already there — nothing to do.")
            return
        domains = {d.code: d for d in db.query(Domain).all()}
        themes = {t.code: t for t in db.query(Theme).all()}
        seed_life_skills_topics(db, domains, themes)
        db.commit()
        print("Added feelings_basic and daily_routines.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
