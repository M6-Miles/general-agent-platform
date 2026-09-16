from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.config_secrets import get_settings_with_secrets
from app.db import get_db
from app.middleware.rate_limit import RateLimiter
from app.models import Tenant, TenantQuota, User, UserSession
from app.security import bearer, decode_access_token

_RATE_LIMITER = RateLimiter(redis_url=get_settings_with_secrets().redis_url)


@dataclass(frozen=True)
class Principal:
    user_id: str
    tenant_id: str
    role: str
    request_id: str
    session_id: str | None = None


def get_principal(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> Principal:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="UNAUTHORIZED")
    payload = decode_access_token(credentials.credentials)
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        db.info["tenant_id"] = payload["tenant_id"]
        db.execute(text("SELECT set_config('app.tenant_id', :tenant_id, true)"), {"tenant_id": payload["tenant_id"]})
    user = db.get(User, payload["sub"])
    tenant = db.get(Tenant, payload["tenant_id"])
    session = db.get(UserSession, payload.get("sid")) if payload.get("sid") else None
    if user is None or tenant is None or tenant.status != "active" or user.deleted_at is not None or user.status != "active" or user.tenant_id != payload["tenant_id"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="UNAUTHORIZED")
    if payload.get("sid") and (session is None or session.user_id != user.id or session.revoked_at is not None):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="UNAUTHORIZED")
    return Principal(user_id=user.id, tenant_id=user.tenant_id, role=user.role, request_id=request.state.request_id, session_id=payload.get("sid"))


def require_role(*roles: str):
    def dependency(principal: Principal = Depends(get_principal)) -> Principal:
        if principal.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="FORBIDDEN")
        return principal

    return dependency


def require_permission(*permissions: str):
    """Small RBAC gate; permission names remain stable for future ABAC expansion."""
    role_permissions = {
        "admin": {"*"},
        "tenant_admin": {"agent:read", "agent:write", "agent:delete", "tool:read", "tool:write", "run:read", "run:execute", "approval:decide", "audit:read", "audit:export", "memory:read", "memory:write", "user:read", "user:write", "admin:settings"},
        "member": {"agent:read", "run:read", "run:execute", "tool:read", "approval:decide", "audit:read", "memory:read", "memory:write"},
        "readonly": {"agent:read", "run:read", "tool:read", "audit:read", "memory:read"},
    }
    def dependency(request: Request, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)) -> Principal:
        runtime_settings = get_settings_with_secrets()
        quota = db.get(TenantQuota, principal.tenant_id)
        limit = quota.max_requests_per_minute if quota is not None else runtime_settings.rate_limit_default
        if not runtime_settings.rate_limit_enabled:
            # Keep response headers truthful even when enforcement is disabled;
            # callers still observe the request budget contract.
            allowed, remaining, reset = True, max(0, limit - 1), 0
        else:
            allowed, remaining, reset = _RATE_LIMITER.check(principal.tenant_id, limit=limit)
        request.state.rate_limit = (max(0, limit), remaining, reset)
        if not allowed:
            raise HTTPException(status_code=429, detail="RATE_LIMIT_EXCEEDED", headers={"Retry-After": str(reset)})
        granted = role_permissions.get(principal.role, set())
        if "*" not in granted and not set(permissions).issubset(granted):
            record_audit(
                db,
                tenant_id=principal.tenant_id,
                actor_id=principal.user_id,
                action="permission.denied",
                resource_type="permission",
                resource_id=",".join(permissions),
                request_id=request.state.request_id,
                metadata={"requiredPermissions": list(permissions), "role": principal.role},
                outcome="denied",
            )
            db.commit()
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="FORBIDDEN")
        return principal
    return dependency
