"""
Parent-chosen companion (docs/PLAN.md UX-overhaul Phase C): the parent types
whatever their child is actually into ("trains", "unicorns", ...) instead of
picking from the 4 fixed built-in themes, the app searches Wikimedia Commons
for real, licensed photos, and the PARENT must explicitly pick one before it
is ever downloaded/stored/shown to the child — Commons' own curation is the
first safety layer, this module's own text/content checks are the second,
and the parent's own review is the final one (README §22's "reviewed before
a child ever sees it" principle, applied to parent-sourced content too).

Deliberately separate from the Theme/Arm machinery in app/models/curriculum.py
and app/engine/experiment_manager.py: the companion is decorative (which
character talks to the child), not a new arm in the theme-preference
randomized comparison — inserting parent-picked, uncontrolled content into
that experiment would break its validity. The 4 built-in themes stay exactly
as they are; the companion is an independent personalization layer on top.
"""
import io
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

from PIL import Image
from sqlalchemy.orm import Session as DBSession

from app.models.identity import Child

COMMONS_API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "AURA-child-learning-app/1.0 (educational, non-commercial)"
REQUEST_TIMEOUT_S = 15
MAX_CANDIDATES = 4

MEDIA_DIR = Path(__file__).resolve().parents[2] / "media" / "companions"

MAX_QUERY_WORDS = 5
MAX_QUERY_CHARS = 40
BANNED_WORDS = {"stupid", "dumb", "wrong", "fail", "bad", "hate", "kill", "die", "scary", "afraid", "sex", "nude", "gun", "weapon", "blood"}

# Commons' own curation is the first safety layer, but a plain keyword search
# still surfaces things like disaster photography for perfectly innocent
# queries (e.g. "trains" -> a 19th-century train wreck) — filtered out of
# candidates by FILE TITLE as a second layer. The parent picking one of what
# remains, before a child ever sees it, is the final and most important one.
UNSAFE_TITLE_WORDS = {"wreck", "crash", "accident", "disaster", "dead", "death", "died", "fire", "explosion", "war", "attack", "injury", "injured", "victim"}


def validate_query(query: str) -> list[str]:
    violations = []
    text = query.strip()
    if not text:
        violations.append("empty")
        return violations
    words = text.split()
    if len(words) > MAX_QUERY_WORDS:
        violations.append(f"too many words ({len(words)} > {MAX_QUERY_WORDS})")
    if len(text) > MAX_QUERY_CHARS:
        violations.append(f"too long ({len(text)} chars > {MAX_QUERY_CHARS})")
    if any(w in BANNED_WORDS for w in text.lower().split()):
        violations.append("contains a banned word")
    if not re.match(r"^[A-Za-z0-9 '-]+$", text):
        violations.append("contains unexpected characters")
    return violations


def _commons_get(params: dict, retries: int = 3) -> dict:
    query = urllib.parse.urlencode(params)
    req = urllib.request.Request(f"{COMMONS_API}?{query}", headers={"User-Agent": USER_AGENT})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_S) as resp:
                import json
                return json.loads(resp.read())
        except urllib.error.HTTPError as exc:
            if exc.code == 429 and attempt < retries - 1:
                time.sleep(3 * (attempt + 1))
                continue
            raise
    return {}


def search_companion_images(query: str) -> list[dict]:
    violations = validate_query(query)
    if violations:
        raise ValueError(f"invalid query: {', '.join(violations)}")

    data = _commons_get({
        "action": "query",
        "generator": "search",
        "gsrsearch": f"filetype:bitmap {query}",
        "gsrnamespace": 6,
        "gsrlimit": MAX_CANDIDATES * 3,  # over-fetch — UNSAFE_TITLE_WORDS filtering below drops some
        "prop": "imageinfo",
        "iiprop": "url|extmetadata|mime",
        "format": "json",
    })
    pages = data.get("query", {}).get("pages", {})
    candidates = []
    for page in pages.values():
        info = (page.get("imageinfo") or [{}])[0]
        mime = info.get("mime", "")
        url = info.get("url")
        if not url or not mime.startswith("image/") or mime == "image/svg+xml":
            continue
        title = page.get("title", "").removeprefix("File:")
        if any(w in title.lower() for w in UNSAFE_TITLE_WORDS):
            continue
        meta = info.get("extmetadata", {})
        license_name = meta.get("LicenseShortName", {}).get("value", "Unknown license")
        candidates.append({"image_url": url, "source_title": title, "license": license_name})
        if len(candidates) == MAX_CANDIDATES:
            break
    return candidates


def _download_and_square(url: str, dest: Path, size: int = 480) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_S) as resp:
        raw = resp.read()

    image = Image.open(io.BytesIO(raw)).convert("RGB")
    side = min(image.width, image.height)
    left = (image.width - side) // 2
    top = (image.height - side) // 2
    image = image.crop((left, top, left + side, top + side)).resize((size, size), Image.LANCZOS)

    dest.parent.mkdir(parents=True, exist_ok=True)
    image.save(dest, "JPEG", quality=88)


def set_child_companion(db: DBSession, child_id: str, query: str, image_url: str, source_title: str) -> Child:
    violations = validate_query(query)
    if violations:
        raise ValueError(f"invalid query: {', '.join(violations)}")

    child = db.query(Child).filter_by(id=child_id).one()
    filename = f"{child_id}.jpg"
    _download_and_square(image_url, MEDIA_DIR / filename)

    child.companion_name = query.strip().title()
    child.companion_image_path = f"companions/{filename}"
    child.companion_source_title = source_title
    db.commit()
    db.refresh(child)
    return child


def delete_companion_file(child: Child) -> None:
    if not child.companion_image_path:
        return
    path = MEDIA_DIR.parent / child.companion_image_path
    path.unlink(missing_ok=True)


def companion_candidate_id(candidate: dict) -> str:
    return uuid.uuid5(uuid.NAMESPACE_URL, candidate["image_url"]).hex[:8]
