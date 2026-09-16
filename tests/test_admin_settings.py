from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.main import app, settings
from app.models import AuditEvent
from tests.test_runtime import auth_headers


def test_admin_settings_redact_secrets_and_allow_runtime_update():
    original = {
        "embedding_provider": settings.embedding_provider,
        "embedding_model": settings.embedding_model,
        "rate_limit_enabled": settings.rate_limit_enabled,
        "rate_limit_default": settings.rate_limit_default,
    }
    try:
        with TestClient(app) as client:
            headers = auth_headers(client)
            response = client.get("/api/v1/admin/settings", headers=headers)
            assert response.status_code == 200
            body = response.json()["data"]
            assert "secret_key" not in body
            updated = client.put(
                "/api/v1/admin/settings",
                headers=headers,
                json={"embedding_provider": "mock", "rate_limit_enabled": False, "rate_limit_default": 42},
            )
            assert updated.status_code == 200
            assert updated.json()["data"]["rate_limit_default"] == 42
            with SessionLocal() as db:
                event = db.query(AuditEvent).filter(AuditEvent.action == "admin_settings.updated").order_by(AuditEvent.created_at.desc()).first()
                assert event is not None
                assert event.metadata_json["changed"]["rate_limit_enabled"]["to"] is False
    finally:
        for key, value in original.items():
            setattr(settings, key, value)


def test_non_admin_cannot_access_admin_settings():
    with TestClient(app) as client:
        response = client.post("/api/v1/auth/login", json={"email": "member@example.com", "password": "ChangeMe123456!"})
        if response.status_code == 401:
            from scripts.seed import main
            main()
            response = client.post("/api/v1/auth/login", json={"email": "member@example.com", "password": "ChangeMe123456!"})
        headers = {"Authorization": f"Bearer {response.json()['data']['access_token']}"}
        assert client.get("/api/v1/admin/settings", headers=headers).status_code == 403
