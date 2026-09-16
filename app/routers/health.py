"""Health and readiness endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config_secrets import get_settings_with_secrets
from app.db import get_db

try:
    from redis import Redis
except ImportError:  # pragma: no cover
    Redis = None

router = APIRouter(tags=["health"])
settings = get_settings_with_secrets()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
def ready(db: Session = Depends(get_db)) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(status_code=503, detail="SERVICE_UNAVAILABLE") from exc
    if settings.app_env == "production" and Redis is not None:
        try:
            Redis.from_url(settings.redis_url, socket_connect_timeout=1, socket_timeout=1).ping()
        except Exception as exc:
            raise HTTPException(status_code=503, detail="SERVICE_UNAVAILABLE") from exc
    return {"status": "ready"}
