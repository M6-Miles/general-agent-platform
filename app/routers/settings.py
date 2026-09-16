"""User, tenant, and runtime settings endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.db import get_db
from app.dependencies import Principal, get_principal, require_permission
from app.models import SystemSetting, TenantQuota, User
from app.quota import tenant_usage
from app.schemas import (
    AdminSettingsOut,
    AdminSettingsUpdate,
    PasswordUpdate,
    ProfileUpdate,
    TenantQuotaOut,
    TenantQuotaUpdate,
)
from app.security import hash_password, verify_password

router = APIRouter(tags=["settings"])


def _runtime_settings():
    # Imported lazily because the application owns the configured settings object.
    from app.main import settings
    return settings


def _load_persisted_settings(db: Session) -> None:
    settings = _runtime_settings()
    persisted_keys = ("model_name", "embedding_provider", "embedding_model", "rate_limit_enabled", "rate_limit_default")
    for key in persisted_keys:
        row = db.get(SystemSetting, key)
        if row is not None and isinstance(row.value_json, dict) and "value" in row.value_json:
            setattr(settings, key, row.value_json["value"])


def get_tenant_quota(tenant_id: str, request: Request, principal: Principal, db: Session):
    if tenant_id != principal.tenant_id:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    quota = db.get(TenantQuota, tenant_id) or TenantQuota(tenant_id=tenant_id)
    data = TenantQuotaOut(
        tenant_id=tenant_id,
        monthly_token_limit=quota.monthly_token_limit or 0,
        monthly_cost_limit_usd=quota.monthly_cost_limit_usd or 0.0,
        max_concurrent_runs=quota.max_concurrent_runs or 0,
        warning_percent=quota.warning_percent or 90,
        max_requests_per_minute=quota.max_requests_per_minute or 0,
        max_knowledge_documents=quota.max_knowledge_documents or 0,
        max_workflow_runs_per_day=quota.max_workflow_runs_per_day or 0,
        usage=tenant_usage(db, tenant_id),
    )
    return {"data": data, "request_id": request.state.request_id}


def update_tenant_quota(tenant_id: str, payload: TenantQuotaUpdate, request: Request, principal: Principal, db: Session):
    if tenant_id != principal.tenant_id or principal.role not in {"admin", "tenant_admin"}:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    quota = db.get(TenantQuota, tenant_id)
    if quota is None:
        quota = TenantQuota(tenant_id=tenant_id)
        db.add(quota)
    for key, value in payload.model_dump().items():
        setattr(quota, key, value)
    record_audit(db, tenant_id=tenant_id, actor_id=principal.user_id, action="quota.updated", resource_type="tenant_quota", resource_id=tenant_id, request_id=request.state.request_id)
    db.commit()
    return get_tenant_quota(tenant_id, request, principal, db)


@router.get("/api/v1/settings/profile", response_model=None)
def get_profile(request: Request, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    user = db.get(User, principal.user_id)
    return {"data": {"id": user.id, "email": user.email, "display_name": user.display_name, "role": user.role, "preferences": user.preferences or {}}, "request_id": request.state.request_id}


@router.put("/api/v1/settings/profile", response_model=None)
def update_profile(payload: ProfileUpdate, request: Request, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    user = db.get(User, principal.user_id)
    user.display_name = payload.display_name
    user.preferences = payload.preferences
    record_audit(db, tenant_id=principal.tenant_id, actor_id=principal.user_id, action="profile.updated", resource_type="user", resource_id=user.id, request_id=request.state.request_id)
    db.commit()
    return get_profile(request, principal, db)


@router.put("/api/v1/settings/password", response_model=None)
def update_password(payload: PasswordUpdate, request: Request, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    user = db.get(User, principal.user_id)
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="CURRENT_PASSWORD_INVALID")
    user.password_hash = hash_password(payload.new_password)
    record_audit(db, tenant_id=principal.tenant_id, actor_id=principal.user_id, action="profile.password_updated", resource_type="user", resource_id=user.id, request_id=request.state.request_id)
    db.commit()
    return {"data": {"updated": True}, "request_id": request.state.request_id}


@router.get("/api/v1/settings/tenant", response_model=None)
def get_settings_tenant(request: Request, principal: Principal = Depends(require_permission("user:read")), db: Session = Depends(get_db)):
    return get_tenant_quota(principal.tenant_id, request, principal, db)


@router.put("/api/v1/settings/tenant", response_model=None)
def update_settings_tenant(payload: TenantQuotaUpdate, request: Request, principal: Principal = Depends(require_permission("user:write")), db: Session = Depends(get_db)):
    return update_tenant_quota(principal.tenant_id, payload, request, principal, db)


@router.get("/api/v1/admin/settings", response_model=None)
def get_admin_settings(request: Request, principal: Principal = Depends(require_permission("admin:settings")), db: Session = Depends(get_db)):
    if principal.role != "admin":
        raise HTTPException(status_code=403, detail="FORBIDDEN")
    _load_persisted_settings(db)
    settings = _runtime_settings()
    data = AdminSettingsOut(
        app_env=settings.app_env,
        model_provider=settings.model_provider,
        model_name=settings.model_name,
        embedding_provider=settings.embedding_provider,
        embedding_model=settings.embedding_model,
        rate_limit_enabled=settings.rate_limit_enabled,
        rate_limit_default=settings.rate_limit_default,
    )
    return {"data": data, "request_id": request.state.request_id}


@router.put("/api/v1/admin/settings", response_model=None)
def update_admin_settings(payload: AdminSettingsUpdate, request: Request, principal: Principal = Depends(require_permission("admin:settings")), db: Session = Depends(get_db)):
    if principal.role != "admin":
        raise HTTPException(status_code=403, detail="FORBIDDEN")
    settings = _runtime_settings()
    changes = payload.model_dump(exclude_none=True)
    before = {key: getattr(settings, key) for key in changes}
    for key, value in changes.items():
        setattr(settings, key, value)
        row = db.get(SystemSetting, key)
        if row is None:
            row = SystemSetting(key=key)
            db.add(row)
        row.value_json = {"value": value}
        row.updated_by = principal.user_id
    record_audit(
        db, tenant_id=principal.tenant_id, actor_id=principal.user_id, action="admin_settings.updated",
        resource_type="system_settings", resource_id="runtime", request_id=request.state.request_id,
        metadata={"changed": {key: {"from": before[key], "to": value} for key, value in changes.items()}},
    )
    db.commit()
    return get_admin_settings(request, principal, db)


@router.get("/api/v1/tenants/{tenant_id}/quota", response_model=None)
def get_tenant_quota_route(tenant_id: str, request: Request, principal: Principal = Depends(require_permission("audit:read")), db: Session = Depends(get_db)):
    return get_tenant_quota(tenant_id, request, principal, db)


@router.put("/api/v1/tenants/{tenant_id}/quota", response_model=None)
def update_tenant_quota_route(tenant_id: str, payload: TenantQuotaUpdate, request: Request, principal: Principal = Depends(require_permission("user:write")), db: Session = Depends(get_db)):
    return update_tenant_quota(tenant_id, payload, request, principal, db)
