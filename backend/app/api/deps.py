"""Shared FastAPI dependencies: the current authenticated user, and access
checks (e.g. "is this user a guardian of this child?")."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session as DBSession

from app.core.security import decode_access_token
from app.db import get_db
from app.models.identity import Guardianship, User

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: DBSession = Depends(get_db),
) -> User:
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = db.query(User).filter_by(id=user_id).one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User no longer exists")
    return user


def require_guardian_of(child_id: str, user: User, db: DBSession) -> None:
    """Raises 403 unless `user` is a guardian of `child_id`. Called explicitly
    inside each parent-facing endpoint (rather than as a bare Depends) since
    it needs the path parameter's child_id."""
    link = (
        db.query(Guardianship)
        .filter_by(user_id=user.id, child_id=child_id)
        .one_or_none()
    )
    if link is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a guardian of this child")
