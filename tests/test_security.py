import os
from uuid import uuid4

os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-characters")

from fastapi.testclient import TestClient

from app.main import app


def _login(client, email):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": "ChangeMe123456!"})
    if response.status_code == 401:
        from scripts.seed import main

        main()
        response = client.post("/api/v1/auth/login", json={"email": email, "password": "ChangeMe123456!"})
    return {"Authorization": f"Bearer {response.json()['data']['access_token']}"}


def test_protected_endpoint_rejects_missing_and_invalid_credentials():
    with TestClient(app) as client:
        assert client.get("/api/v1/agents").status_code == 401
        assert client.get("/api/v1/agents", headers={"Authorization": "Bearer forged"}).status_code == 401


def test_security_headers_are_present():
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"
        assert response.headers["Referrer-Policy"] == "no-referrer"


def test_metrics_does_not_expose_request_payloads():
    with TestClient(app) as client:
        body = client.get("/metrics").text
        assert "agent_http_requests_total" in body
        assert "password" not in body.lower()


def test_readonly_cannot_create_run_and_member_cannot_delete_agent():
    with TestClient(app) as client:
        admin = _login(client, "admin@example.com")
        agent = client.post("/api/v1/agents", headers=admin, json={"name": "security-boundary-agent", "definition": {}})
        agent_id = agent.json()["data"]["id"]
        readonly = _login(client, "readonly@example.com")
        denied_run = client.post("/api/v1/runs", headers=readonly, json={"agent_id": agent_id, "input": {}})
        assert denied_run.status_code == 403
        member = _login(client, "member@example.com")
        denied_delete = client.delete(f"/api/v1/agents/{agent_id}", headers=member)
        assert denied_delete.status_code == 403


def test_readonly_cannot_execute_runs_create_tool_calls_or_write_memories():
    with TestClient(app) as client:
        admin = _login(client, "admin@example.com")
        agent = client.post("/api/v1/agents", headers=admin, json={"name": "permission-boundary-agent", "definition": {}}).json()["data"]
        assert client.post(f"/api/v1/agents/{agent['id']}/publish", headers=admin).status_code == 201
        run = client.post("/api/v1/runs", headers=admin, json={"agent_id": agent["id"], "input": {}}).json()["data"]
        readonly = _login(client, "readonly@example.com")
        tool_payload = {"tool_name": "missing-tool", "input": {}, "idempotency_key": "readonly-tool-call-001"}
        memory_payload = {"content": "should be denied", "metadata": {}}
        assert client.post(f"/api/v1/runs/{run['id']}/tool-calls", headers=readonly, json=tool_payload).status_code == 403
        assert client.post(f"/api/v1/runs/{run['id']}/execute", headers=readonly).status_code == 403
        assert client.post(f"/api/v1/runs/{run['id']}/execute-stream", headers=readonly).status_code == 403
        assert client.post(f"/api/v1/agents/{agent['id']}/memories", headers=readonly, json=memory_payload).status_code == 403


def test_logout_revokes_access_token():
    with TestClient(app) as client:
        headers = _login(client, "admin@example.com")
        assert client.get("/api/v1/agents", headers=headers).status_code == 200
        assert client.post("/api/v1/auth/logout", headers=headers).status_code == 204
        assert client.get("/api/v1/agents", headers=headers).status_code == 401


def test_refresh_token_rotates_in_httponly_cookie_and_old_token_is_rejected():
    with TestClient(app) as client:
        response = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "ChangeMe123456!"})
        if response.status_code == 401:
            from scripts.seed import main
            main()
            response = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "ChangeMe123456!"})
        assert "refresh_token" not in response.json()["data"]
        set_cookie = response.headers["set-cookie"]
        assert "agent_refresh_token=" in set_cookie
        assert "HttpOnly" in set_cookie
        old_refresh = client.cookies.get("agent_refresh_token")
        rotated = client.post("/api/v1/auth/refresh")
        assert rotated.status_code == 200
        assert "refresh_token" not in rotated.json()["data"]
        assert client.cookies.get("agent_refresh_token") != old_refresh
        client.cookies.clear()
        assert client.post("/api/v1/auth/refresh", headers={"Cookie": f"agent_refresh_token={old_refresh}"}).status_code == 401


def test_prod_alias_uses_secure_refresh_cookie():
    from fastapi import Response

    from app.main import _set_refresh_cookie, settings

    previous_env = settings.app_env
    settings.app_env = "prod"
    try:
        response = Response()
        _set_refresh_cookie(response, "refresh-token")
        assert "Secure" in response.headers["set-cookie"]
    finally:
        settings.app_env = previous_env


def test_login_rejects_ambiguous_email_and_accepts_tenant_slug():
    from app.db import SessionLocal
    from app.models import Tenant, User
    from app.security import hash_password

    suffix = uuid4().hex[:8]
    email = f"duplicate-{suffix}@example.com"
    selected_slug = f"login-a-{suffix}"
    with SessionLocal() as db:
        first = Tenant(name=f"Login Tenant A {suffix}", slug=selected_slug)
        second = Tenant(name=f"Login Tenant B {suffix}", slug=f"login-b-{suffix}")
        db.add_all([first, second])
        db.flush()
        db.add_all([
            User(
                tenant_id=first.id,
                email=email,
                display_name="First Tenant Admin",
                password_hash=hash_password("ChangeMe123456!"),
                role="admin",
            ),
            User(
                tenant_id=second.id,
                email=email,
                display_name="Second Tenant Admin",
                password_hash=hash_password("ChangeMe123456!"),
                role="admin",
            ),
        ])
        db.commit()

    with TestClient(app) as client:
        ambiguous = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "ChangeMe123456!"},
        )
        assert ambiguous.status_code == 401
        scoped = client.post(
            "/api/v1/auth/login",
            json={
                "email": email,
                "password": "ChangeMe123456!",
                "tenant_slug": selected_slug,
            },
        )
        assert scoped.status_code == 200
        assert scoped.json()["data"]["user"]["email"] == email


def test_login_failed_attempts_are_rate_limited_and_audited():
    from app.db import SessionLocal
    from app.models import AuditEvent

    email = f"rate-limited-{uuid4().hex[:8]}@example.com"
    with TestClient(app) as client:
        for _ in range(5):
            response = client.post(
                "/api/v1/auth/login",
                json={"email": email, "password": "WrongPassword123!", "tenant_slug": "demo"},
            )
            assert response.status_code == 401
        blocked = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "WrongPassword123!", "tenant_slug": "demo"},
        )
        assert blocked.status_code == 429
        assert blocked.json()["error"]["code"] == "LOGIN_RATE_LIMITED"
        assert int(blocked.headers["Retry-After"]) > 0

    with SessionLocal() as db:
        event = db.query(AuditEvent).filter(
            AuditEvent.action == "user.login_rate_limited",
            AuditEvent.resource_id == email,
        ).order_by(AuditEvent.created_at.desc()).first()
        assert event is not None
        assert event.reason_code == "LOGIN_RATE_LIMITED"


def test_password_reset_requests_are_rate_limited_per_account():
    email = f"reset-rate-{uuid4().hex[:8]}@example.com"
    with TestClient(app) as client:
        for _ in range(5):
            response = client.post(
                "/api/v1/auth/password-reset/request",
                json={"email": email, "tenant_slug": "demo"},
            )
            assert response.status_code == 200
        blocked = client.post(
            "/api/v1/auth/password-reset/request",
            json={"email": email, "tenant_slug": "demo"},
        )
        assert blocked.status_code == 429
        assert blocked.json()["error"]["code"] == "PASSWORD_RESET_RATE_LIMITED"
        assert int(blocked.headers["Retry-After"]) > 0


def test_suspended_user_token_is_rejected():
    with TestClient(app) as client:
        headers = _login(client, "admin@example.com")
        from app.db import SessionLocal
        from app.models import User
        with SessionLocal() as db:
            user = db.query(User).filter(User.email == "admin@example.com").first()
            user.status = "suspended"
            db.commit()
        try:
            assert client.get("/api/v1/agents", headers=headers).status_code == 401
        finally:
            with SessionLocal() as db:
                user = db.query(User).filter(User.email == "admin@example.com").first()
                user.status = "active"
                db.commit()
