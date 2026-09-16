"""
Password hashing + JWT issuance/verification. Minimal on purpose — this is a
research prototype's auth, not a production identity system (docs/PLAN.md
Phase 3: "Real auth (JWT, roles) lands with the dashboards").
"""
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.config import settings

# Using bcrypt directly rather than passlib: passlib 1.7.4 (last released
# 2020, effectively unmaintained) is incompatible with bcrypt>=4.1 (it reads
# a `bcrypt.__about__` attribute that no longer exists, and mishandles
# bcrypt's newer >72-byte-password ValueError). Talking to bcrypt directly
# sidesteps that whole class of version-drift bugs.
_MAX_BCRYPT_BYTES = 72


def hash_password(password: str) -> str:
    truncated = password.encode("utf-8")[:_MAX_BCRYPT_BYTES]
    return bcrypt.hashpw(truncated, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    truncated = password.encode("utf-8")[:_MAX_BCRYPT_BYTES]
    return bcrypt.checkpw(truncated, password_hash.encode("utf-8"))


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_access_token(token: str) -> str | None:
    """Returns the user id encoded in the token, or None if invalid/expired."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        return payload.get("sub")
    except JWTError:
        return None
