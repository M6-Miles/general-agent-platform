from fastapi.testclient import TestClient

from app.main import app
from tests.test_runtime import auth_headers


def test_profile_settings_can_be_read_and_updated():
    with TestClient(app) as client:
        headers = auth_headers(client)
        current = client.get("/api/v1/settings/profile", headers=headers)
        assert current.status_code == 200
        updated = client.put("/api/v1/settings/profile", headers=headers, json={"display_name": "本地验收用户", "preferences": {"language": "zh-CN"}})
        assert updated.status_code == 200
        assert updated.json()["data"]["display_name"] == "本地验收用户"
        assert updated.json()["data"]["preferences"]["language"] == "zh-CN"


def test_tenant_settings_are_available_to_admin():
    with TestClient(app) as client:
        headers = auth_headers(client)
        response = client.get("/api/v1/settings/tenant", headers=headers)
        assert response.status_code == 200
        assert "monthly_token_limit" in response.json()["data"]
