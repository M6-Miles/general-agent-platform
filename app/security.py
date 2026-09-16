from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
from fastapi import HTTPException, status
from fastapi.security import HTTPBearer
from pwdlib import PasswordHash

password_hash = PasswordHash.recommended()
bearer = HTTPBearer(auto_error=False)


def _get_settings():
    """Get settings with secret manager support."""
    try:
        from app.config_secrets import get_settings_with_secrets
        return get_settings_with_secrets()
    except ImportError:
        from app.config import get_settings
        return get_settings()


def hash_password(value: str) -> str:
    return password_hash.hash(value)


def verify_password(value: str, hashed: str) -> bool:
    return password_hash.verify(value, hashed)


def create_access_token(*, user_id: str, tenant_id: str, role: str, session_id: str | None = None) -> tuple[str, datetime]:
    settings = _get_settings()
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.access_token_ttl_minutes)
    payload = {"sub": user_id, "tenant_id": tenant_id, "role": role, "exp": expires_at, "type": "access", "jti": str(uuid4())}
    if session_id:
        payload["sid"] = session_id
    return jwt.encode(payload, settings.secret_key, algorithm="HS256"), expires_at


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, _get_settings().secret_key, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="UNAUTHORIZED") from exc
    if payload.get("type") != "access" or not payload.get("sub") or not payload.get("tenant_id"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="UNAUTHORIZED")
    return payload


def create_password_reset_token(*, user_id: str, tenant_id: str, password_version: int) -> tuple[str, datetime]:
    settings = _get_settings()
    expires_at = datetime.now(UTC) + timedelta(minutes=15)
    payload = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "password_version": password_version,
        "exp": expires_at,
        "type": "password_reset",
        "jti": str(uuid4()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256"), expires_at


def decode_password_reset_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, _get_settings().secret_key, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="RESET_TOKEN_INVALID") from exc
    if payload.get("type") != "password_reset" or not payload.get("sub") or not payload.get("tenant_id"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="RESET_TOKEN_INVALID")
    return payload
