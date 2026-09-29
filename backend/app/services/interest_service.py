"""
A child's interests (plan Phase 1): several parent-approved real photos
instead of one companion. Built on companion_service's Commons search,
safety checks and download pipeline; the favourite interest is mirrored into
Child.companion_* so everything that already reads the companion (the
DecisionEngine's guide, the child space) keeps working unchanged.
"""
import urllib.error
import uuid

from PIL import UnidentifiedImageError
from sqlalchemy.orm import Session as DBSession

from app.models.identity import Child, ChildInterest
from app.services import companion_service

MAX_INTERESTS = 6
INTERESTS_DIR = companion_service.MEDIA_DIR.parent / "interests"

# Free-text interest -> built-in theme, so what the parent types still seeds
# the randomized theme experiment's prior (README §6: a PRIOR, never the
# current value). Deliberately small and literal; no match just means no prior.
THEME_KEYWORDS = {
    "dino": ("dino", "dinosaur", "t-rex", "trex", "raptor", "fossil", "jurassic"),
    "space": ("space", "rocket", "planet", "astronaut", "star", "moon", "galaxy", "alien", "solar"),
    "ocean": ("ocean", "sea", "fish", "shark", "whale", "dolphin", "octopus", "turtle", "beach", "underwater"),
    "cars": ("car", "truck", "racing", "race car", "vehicle", "bus", "tractor", "digger", "fire engine"),
}


def infer_theme_code(label: str) -> str | None:
    text = label.lower()
    for code, words in THEME_KEYWORDS.items():
        if any(w in text for w in words):
            return code
    return None


def validate_label(label: str) -> str:
    violations = companion_service.validate_query(label)
    if violations:
        raise ValueError(f"'{label}' can't be used: {', '.join(violations)}")
    return label.strip()


def download_interest_image(image_url: str) -> str:
    """Downloads + squares the photo; returns its path relative to media/.
    Any fetch/decode failure becomes a ValueError the API turns into a clear
    400, never an unexplained 500."""
    filename = f"{uuid.uuid4().hex}.jpg"
    try:
        companion_service._download_and_square(image_url, INTERESTS_DIR / filename)
    except ValueError:
        raise
    except (urllib.error.URLError, OSError, UnidentifiedImageError) as exc:
        raise ValueError("Couldn't fetch one of the photos. Please pick another one.") from exc
    return f"interests/{filename}"


def _set_favourite(child: Child, interest: ChildInterest) -> None:
    for other in child.interests:
        other.is_favourite = other.id == interest.id
    child.companion_name = interest.label.title()
    child.companion_image_path = interest.image_path
    child.companion_source_title = interest.source_title


def attach_interest(db: DBSession, child: Child, label: str, image_path: str, source_title: str, favourite: bool) -> ChildInterest:
    """Adds an already-downloaded interest to the child (no commit)."""
    interest = ChildInterest(child_id=child.id, label=validate_label(label), image_path=image_path, source_title=source_title)
    db.add(interest)
    db.flush()
    db.refresh(child)
    if favourite or not any(i.is_favourite for i in child.interests if i.id != interest.id):
        _set_favourite(child, interest)
    return interest


def add_interest(db: DBSession, child_id: str, label: str, image_url: str, source_title: str, favourite: bool = False) -> ChildInterest:
    child = db.query(Child).filter_by(id=child_id).one()
    if len(child.interests) >= MAX_INTERESTS:
        raise ValueError(f"A child can have at most {MAX_INTERESTS} interests.")
    validate_label(label)
    image_path = download_interest_image(image_url)
    interest = attach_interest(db, child, label, image_path, source_title, favourite)
    db.commit()
    db.refresh(interest)
    return interest


def set_favourite(db: DBSession, child_id: str, interest_id: str) -> Child:
    child = db.query(Child).filter_by(id=child_id).one()
    interest = next((i for i in child.interests if i.id == interest_id), None)
    if interest is None:
        raise ValueError("No such interest for this child.")
    _set_favourite(child, interest)
    db.commit()
    db.refresh(child)
    return child


def remove_interest(db: DBSession, child_id: str, interest_id: str) -> Child:
    child = db.query(Child).filter_by(id=child_id).one()
    interest = next((i for i in child.interests if i.id == interest_id), None)
    if interest is None:
        raise ValueError("No such interest for this child.")
    was_favourite = interest.is_favourite
    _delete_file(interest.image_path)
    db.delete(interest)
    db.flush()
    db.refresh(child)
    if was_favourite:
        if child.interests:
            _set_favourite(child, child.interests[0])
        else:
            child.companion_name = child.companion_image_path = child.companion_source_title = None
    db.commit()
    db.refresh(child)
    return child


def _delete_file(image_path: str) -> None:
    (companion_service.MEDIA_DIR.parent / image_path).unlink(missing_ok=True)


def delete_all_interest_files(child: Child) -> None:
    """Withdrawal (parent_service.withdraw_and_delete_child): stored photos
    are erased along with the rows."""
    for interest in child.interests:
        _delete_file(interest.image_path)
