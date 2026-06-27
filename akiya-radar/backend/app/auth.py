"""Simple single-user auth (MVP).

A single admin password (from env) is hashed at startup; ``/auth/login`` issues
a JWT. Protection is OPT-IN via ``AUTH_ENABLED`` so the MVP works out of the box;
the structure is ready to grow into real multi-user accounts later.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import Settings, get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

_ADMIN_SUBJECT = "admin"


def verify_password(plain: str, settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    # The configured password is treated as the source of truth; we compare
    # directly (constant-time via passlib by hashing then verifying).
    hashed = pwd_context.hash(settings.admin_password)
    return pwd_context.verify(plain, hashed)


def create_access_token(settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    expire = datetime.now(UTC) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": _ADMIN_SUBJECT, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def require_auth(
    token: str | None = Depends(oauth2_scheme),
    settings: Settings = Depends(get_settings),
) -> str:
    if not getattr(settings, "auth_enabled", False):
        return _ADMIN_SUBJECT
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from exc
    return payload.get("sub", _ADMIN_SUBJECT)
