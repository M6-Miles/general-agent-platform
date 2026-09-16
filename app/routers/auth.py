"""Authentication endpoints."""

import hashlib
import logging
import secrets
import smtplib
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.config_secrets import get_settings_with_secrets
from app.db import get_db
from app.dependencies import Principal, get_principal, require_permission
from app.middleware.rate_limit import RateLimiter
from app.models import Tenant, User, UserSession
from app.schemas import (
    AuthResponse,
    InviteUserRequest,
    InviteUserResponse,
    LoginRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    RegisterRequest,
)
from app.security import (
    create_access_token,
    create_password_reset_token,
    decode_password_reset_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
logger = logging.getLogger(__name__)
_PASSWORD_RESET_WINDOW_SECONDS = 15 * 60
_PASSWORD_RESET_LIMITS = {"ip": 20, "account": 5}
_PASSWORD_RESET_LIMITERS = {
    name: RateLimiter(limit=limit, window_seconds=_PASSWORD_RESET_WINDOW_SECONDS, redis_url=get_settings_with_secrets().redis_url)
    for name, limit in _PASSWORD_RESET_LIMITS.items()
}


def _check_password_reset_limit(request: Request, payload: PasswordResetRequest) -> tuple[bool, int]:
    ip = request.client.host if request.client else "unknown"
    account = f"{payload.tenant_slug.strip().lower()}:{str(payload.email).strip().lower()}"
    keys = {
        "ip": hashlib.sha256(ip.encode()).hexdigest(),
        "account": hashlib.sha256(account.encode()).hexdigest(),
    }
    results = [
        _PASSWORD_RESET_LIMITERS[name].check(key, limit=_PASSWORD_RESET_LIMITS[name])
        for name, key in keys.items()
    ]
    blocked = next((result for result in results if not result[0]), None)
    if blocked is not None:
        return False, max(1, blocked[2])
    return True, min((result[2] for result in results), default=_PASSWORD_RESET_WINDOW_SECONDS)


def _send_reset_email(*, recipient: str, reset_url: str) -> bool:
    settings = get_settings_with_secrets()
    if not settings.smtp_host or not settings.smtp_from:
        return False
    message = EmailMessage()
    message["Subject"] = "Agent 平台密码重置"
    message["From"] = settings.smtp_from
    message["To"] = recipient
    message.set_content(f"你好，\n\n请在 15 分钟内打开以下链接重置密码：\n{reset_url}\n\n如果不是你本人操作，请忽略此邮件。")
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as client:
            if settings.smtp_use_tls:
                client.starttls()
            if settings.smtp_username and settings.smtp_password:
                client.login(settings.smtp_username, settings.smtp_password)
            client.send_message(message)
        return True
    except (OSError, smtplib.SMTPException):
        logger.exception("password reset email delivery failed")
        return False


@router.post("/password-reset/request", response_model=dict)
def request_password_reset(payload: PasswordResetRequest, request: Request, db: Session = Depends(get_db)):
    """Issue a short-lived password reset link without revealing account existence."""
    allowed, retry_after = _check_password_reset_limit(request, payload)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="PASSWORD_RESET_RATE_LIMITED",
            headers={"Retry-After": str(retry_after)},
        )
    tenant_slug = payload.tenant_slug.strip().lower()
    email = str(payload.email).strip().lower()
    tenant = db.query(Tenant).filter(Tenant.slug == tenant_slug, Tenant.deleted_at.is_(None)).first()
    user = None
    if tenant is not None:
        if db.bind is not None and db.bind.dialect.name == "postgresql":
            db.info["tenant_id"] = tenant.id
            db.execute(text("SELECT set_config('app.tenant_id', :tenant_id, true)"), {"tenant_id": tenant.id})
        user = db.query(User).filter(User.tenant_id == tenant.id, User.email == email, User.deleted_at.is_(None)).first()

    preview_token = None
    if user is not None and tenant is not None:
        token, _ = create_password_reset_token(user_id=user.id, tenant_id=tenant.id, password_version=user.version)
        settings = get_settings_with_secrets()
        reset_url = f"{settings.public_app_url.rstrip('/')}/reset-password?token={token}"
        delivered = _send_reset_email(recipient=email, reset_url=reset_url)
        if not delivered and settings.app_env.lower() not in {"production", "prod"}:
            preview_token = token
            logger.info("password reset preview generated for local development")
    response = {"message": "如果账号存在，重置链接已发送，请检查邮箱。", "request_id": request.state.request_id}
    if preview_token is not None:
        response["preview_token"] = preview_token
    return {"data": response, "request_id": request.state.request_id}


@router.post("/password-reset/confirm", response_model=dict)
def confirm_password_reset(payload: PasswordResetConfirm, request: Request, db: Session = Depends(get_db)):
    claims = decode_password_reset_token(payload.token)
    tenant_id = str(claims["tenant_id"])
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        db.info["tenant_id"] = tenant_id
        db.execute(text("SELECT set_config('app.tenant_id', :tenant_id, true)"), {"tenant_id": tenant_id})
    user = db.query(User).filter(User.id == str(claims["sub"]), User.tenant_id == tenant_id, User.deleted_at.is_(None)).first()
    if user is None or user.version != int(claims.get("password_version", -1)) or user.status != "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="RESET_TOKEN_EXPIRED")
    user.password_hash = hash_password(payload.new_password)
    user.version += 1
    db.query(UserSession).filter(UserSession.user_id == user.id, UserSession.revoked_at.is_(None)).update({UserSession.revoked_at: datetime.now(UTC)}, synchronize_session=False)
    record_audit(db, tenant_id=tenant_id, actor_id=user.id, action="profile.password_reset", resource_type="user", resource_id=user.id, request_id=request.state.request_id)
    db.commit()
    return {"data": {"message": "密码已重置，请使用新密码登录。"}, "request_id": request.state.request_id}


@router.post("/invite", response_model=dict, status_code=status.HTTP_201_CREATED)
def invite_user(payload: InviteUserRequest, request: Request, principal: Principal = Depends(require_permission("user:write")), db: Session = Depends(get_db)):
    """Create a member with a one-time temporary password for local demos."""
    if get_settings_with_secrets().app_env.lower() in {"production", "prod"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="INVITES_REQUIRE_EMAIL_PROVIDER")
    email = str(payload.email).strip().lower()
    if db.query(User).filter(User.tenant_id == principal.tenant_id, User.email == email, User.deleted_at.is_(None)).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="USER_ALREADY_EXISTS")
    temporary_password = secrets.token_urlsafe(16)
    user = User(tenant_id=principal.tenant_id, email=email, display_name=payload.display_name.strip(), role="member", password_hash=hash_password(temporary_password), created_by=principal.user_id)
    db.add(user)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="USER_ALREADY_EXISTS") from exc
    record_audit(db, tenant_id=principal.tenant_id, actor_id=principal.user_id, action="user.invited", resource_type="user", resource_id=user.id, request_id=request.state.request_id)
    db.commit()
    return {"data": InviteUserResponse(email=email, temporary_password=temporary_password, role=user.role).model_dump(mode="json"), "request_id": request.state.request_id}


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    """Create a local demo tenant and its first administrator, then sign in.

    Open registration is intentionally limited to non-production environments;
    production uses the provisioning/invite flow instead.
    """
    if get_settings_with_secrets().app_env.lower() in {"production", "prod"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="REGISTRATION_DISABLED")

    tenant_slug = payload.tenant_slug.strip().lower()
    email = str(payload.email).strip().lower()
    if db.query(Tenant).filter(Tenant.slug == tenant_slug, Tenant.deleted_at.is_(None)).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="TENANT_ALREADY_EXISTS")

    tenant = Tenant(name=payload.tenant_name.strip(), slug=tenant_slug)
    db.add(tenant)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="TENANT_ALREADY_EXISTS") from exc
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        # RLS policies for the remaining rows require the newly-created tenant
        # to be present in the transaction-local tenant context.
        db.info["tenant_id"] = tenant.id
        db.execute(text("SELECT set_config('app.tenant_id', :tenant_id, true)"), {"tenant_id": tenant.id})
    user = User(
        tenant_id=tenant.id,
        email=email,
        display_name=payload.display_name.strip(),
        role="admin",
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        # Do not leak which field collided; the client can choose another slug.
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="TENANT_OR_EMAIL_ALREADY_EXISTS") from exc

    refresh_token = f"{tenant.id}.{secrets.token_urlsafe(48)}"
    session = UserSession(
        tenant_id=tenant.id,
        user_id=user.id,
        refresh_token_hash=hashlib.sha256(refresh_token.encode()).hexdigest(),
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )
    db.add(session)
    db.flush()
    record_audit(
        db,
        tenant_id=tenant.id,
        actor_id=user.id,
        action="user.registered",
        resource_type="user",
        resource_id=user.id,
        request_id=request.state.request_id,
    )
    token, expires_at = create_access_token(user_id=user.id, tenant_id=tenant.id, role=user.role, session_id=session.id)
    db.commit()
    from app.main import _set_refresh_cookie

    _set_refresh_cookie(response, refresh_token)
    return {
        "data": {
            "access_token": token,
            "expires_at": expires_at,
            "user": {
                "id": user.id,
                "tenant_id": tenant.id,
                "email": user.email,
                "display_name": user.display_name,
                "role": user.role,
                "tenant_name": tenant.name,
            },
        },
        "request_id": request.state.request_id,
    }


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    # These helpers stay in main for now because rate limiting is shared by the
    # application bootstrap; the endpoint itself is owned by this router.
    from app.main import _login_rate_limit, _record_login_block, _set_refresh_cookie

    allowed, retry_after = _login_rate_limit(request, payload, consume=False)
    if not allowed:
        _record_login_block(db, request, payload, retry_after)
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="LOGIN_RATE_LIMITED", headers={"Retry-After": str(retry_after)})
    query = db.query(User).filter(User.email == str(payload.email), User.deleted_at.is_(None))
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        if not payload.tenant_slug:
            raise HTTPException(status_code=401, detail="UNAUTHORIZED")
        tenant = db.query(Tenant).filter(Tenant.slug == payload.tenant_slug, Tenant.deleted_at.is_(None)).first()
        if tenant is None:
            raise HTTPException(status_code=401, detail="UNAUTHORIZED")
        db.info["tenant_id"] = tenant.id
        db.execute(text("SELECT set_config('app.tenant_id', :tenant_id, true)"), {"tenant_id": tenant.id})
        query = query.filter(User.tenant_id == tenant.id)
    if payload.tenant_slug:
        query = query.join(Tenant, Tenant.id == User.tenant_id).filter(Tenant.slug == payload.tenant_slug)
    users = query.limit(2).all()
    if len(users) != 1:
        _login_rate_limit(request, payload, consume=True)
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    user = users[0]
    if user.status != "active" or not verify_password(payload.password, user.password_hash):
        _login_rate_limit(request, payload, consume=True)
        record_audit(db, tenant_id=user.tenant_id, actor_id=user.id, action="user.login_failed", resource_type="user", resource_id=user.id, request_id=request.state.request_id, outcome="failure", reason_code="INVALID_CREDENTIALS")
        db.commit()
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    refresh_token = f"{user.tenant_id}.{secrets.token_urlsafe(48)}"
    session = UserSession(tenant_id=user.tenant_id, user_id=user.id, refresh_token_hash=hashlib.sha256(refresh_token.encode()).hexdigest(), expires_at=datetime.now(UTC) + timedelta(days=7))
    db.add(session)
    db.flush()
    record_audit(db, tenant_id=user.tenant_id, actor_id=user.id, action="user.login", resource_type="user_session", resource_id=session.id, request_id=request.state.request_id)
    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    tenant_name = tenant.name if tenant else None
    token, expires_at = create_access_token(user_id=user.id, tenant_id=user.tenant_id, role=user.role, session_id=session.id)
    db.commit()
    _set_refresh_cookie(response, refresh_token)
    return {"data": {"access_token": token, "expires_at": expires_at, "user": {"id": user.id, "tenant_id": user.tenant_id, "email": user.email, "display_name": user.display_name, "role": user.role, "tenant_name": tenant_name}}, "request_id": request.state.request_id}


@router.post("/refresh", response_model=AuthResponse)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    from app.main import _set_refresh_cookie

    refresh_token = request.cookies.get("agent_refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        tenant_id, separator, _ = refresh_token.partition(".")
        if not separator:
            raise HTTPException(status_code=401, detail="UNAUTHORIZED")
        db.info["tenant_id"] = tenant_id
        db.execute(text("SELECT set_config('app.tenant_id', :tenant_id, true)"), {"tenant_id": tenant_id})
    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    session = db.query(UserSession).filter(UserSession.refresh_token_hash == token_hash).with_for_update().first()
    now = datetime.now(UTC)
    expires_at = session.expires_at.replace(tzinfo=UTC) if session is not None and session.expires_at.tzinfo is None else (session.expires_at if session is not None else None)
    if session is None or session.revoked_at is not None or expires_at <= now:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    user = db.get(User, session.user_id)
    tenant = db.get(Tenant, session.tenant_id)
    if user is None or tenant is None or user.status != "active" or user.deleted_at is not None or tenant.status != "active":
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    next_refresh = f"{user.tenant_id}.{secrets.token_urlsafe(48)}"
    session.refresh_token_hash = hashlib.sha256(next_refresh.encode()).hexdigest()
    token, expires_at = create_access_token(user_id=user.id, tenant_id=user.tenant_id, role=user.role, session_id=session.id)
    record_audit(db, tenant_id=user.tenant_id, actor_id=user.id, action="user.session_refreshed", resource_type="user_session", resource_id=session.id, request_id=request.state.request_id)
    db.commit()
    _set_refresh_cookie(response, next_refresh)
    return {"data": {"access_token": token, "expires_at": expires_at, "user": {"id": user.id, "tenant_id": user.tenant_id, "email": user.email, "display_name": user.display_name, "role": user.role, "tenant_name": tenant.name}}, "request_id": request.state.request_id}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)) -> Response:
    if principal.session_id:
        session = db.get(UserSession, principal.session_id)
        if session is not None and session.revoked_at is None:
            session.revoked_at = datetime.now(UTC)
            record_audit(db, tenant_id=principal.tenant_id, actor_id=principal.user_id, action="user.logout", resource_type="user_session", resource_id=session.id, request_id=request.state.request_id)
            db.commit()
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie("agent_refresh_token", path="/api/v1/auth", samesite="strict")
    return response
