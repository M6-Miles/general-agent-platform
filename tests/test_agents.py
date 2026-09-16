from uuid import uuid4

from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.main import app
from app.models import AgentVersion


def auth_headers(client: TestClient) -> dict[str, str]:
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "ChangeMe123456!"},
    )
    if login.status_code == 401:
        from scripts.seed import main

        main()
        login = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "ChangeMe123456!"},
        )
    return {"Authorization": f"Bearer {login.json()['data']['access_token']}"}


def create_agent(client: TestClient, headers: dict[str, str], definition=None):
    return client.post(
        "/api/v1/agents",
        headers=headers,
        json={"name": f"version-agent-{uuid4().hex}", "definition": definition or {"label": "v1"}},
    ).json()["data"]


def test_agent_publish_creates_immutable_version_snapshot():
    with TestClient(app) as client:
        headers = auth_headers(client)
        agent = create_agent(client, headers)
        published = client.post(f"/api/v1/agents/{agent['id']}/publish", headers=headers)
        assert published.status_code == 201
        snapshot = published.json()["data"]
        assert snapshot["version"] == 1
        assert snapshot["definition"] == {"label": "v1"}
        assert len(snapshot["content_digest"]) == 64

        updated = client.patch(
            f"/api/v1/agents/{agent['id']}",
            headers={**headers, "If-Match": "1"},
            json={"definition": {"label": "v2"}},
        )
        assert updated.status_code == 200
        with SessionLocal() as db:
            stored = db.query(AgentVersion).filter_by(id=snapshot["id"]).one()
            assert stored.definition == {"label": "v1"}
            assert stored.content_digest == snapshot["content_digest"]


def test_agent_list_versions_returns_published_versions_descending():
    with TestClient(app) as client:
        headers = auth_headers(client)
        agent = create_agent(client, headers)
        assert client.post(f"/api/v1/agents/{agent['id']}/publish", headers=headers).status_code == 201
        updated = client.patch(
            f"/api/v1/agents/{agent['id']}",
            headers={**headers, "If-Match": "1"},
            json={"definition": {"label": "v2"}},
        ).json()["data"]
        assert updated["version"] == 2
        assert client.post(f"/api/v1/agents/{agent['id']}/publish", headers=headers).status_code == 201
        versions = client.get(f"/api/v1/agents/{agent['id']}/versions", headers=headers).json()["data"]
        assert [version["version"] for version in versions] == [2, 1]
        assert [version["definition"]["label"] for version in versions] == ["v2", "v1"]


def test_agent_rollback_creates_new_immutable_version():
    with TestClient(app) as client:
        headers = auth_headers(client)
        agent = create_agent(client, headers)
        client.post(f"/api/v1/agents/{agent['id']}/publish", headers=headers)
        client.patch(
            f"/api/v1/agents/{agent['id']}",
            headers={**headers, "If-Match": "1"},
            json={"definition": {"label": "v2"}},
        )
        client.post(f"/api/v1/agents/{agent['id']}/publish", headers=headers)

        rollback = client.post(
            f"/api/v1/agents/{agent['id']}/rollback", headers=headers, json={"version": 1}
        )
        assert rollback.status_code == 201
        restored = rollback.json()["data"]
        assert restored["version"] == 3
        assert restored["definition"] == {"label": "v1"}
        current = client.get(f"/api/v1/agents/{agent['id']}", headers=headers).json()["data"]
        assert current["version"] == 3
        assert current["definition"] == {"label": "v1"}


def test_agent_rollback_rejects_unknown_version():
    with TestClient(app) as client:
        headers = auth_headers(client)
        agent = create_agent(client, headers)
        response = client.post(
            f"/api/v1/agents/{agent['id']}/rollback", headers=headers, json={"version": 99}
        )
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "VERSION_NOT_FOUND"


def test_published_agent_soft_delete_preserves_versions_and_audits():
    with TestClient(app) as client:
        headers = auth_headers(client)
        agent = create_agent(client, headers)
        client.post(f"/api/v1/agents/{agent['id']}/publish", headers=headers)
        deleted = client.delete(f"/api/v1/agents/{agent['id']}", headers=headers)
        assert deleted.status_code == 204
        assert client.get(f"/api/v1/agents/{agent['id']}", headers=headers).status_code == 404
        with SessionLocal() as db:
            assert db.query(AgentVersion).filter_by(agent_id=agent["id"]).count() == 1
        audits = client.get(
            f"/api/v1/audit?resource_type=agent&resource_id={agent['id']}", headers=headers
        ).json()["data"]
        assert "agent.deleted" in {event["action"] for event in audits}
