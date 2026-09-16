from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


def _auth_headers(client: TestClient) -> dict[str, str]:
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


def test_agent_update_requires_if_match_header():
    with TestClient(app) as client:
        headers = _auth_headers(client)
        created = client.post(
            "/api/v1/agents",
            headers=headers,
            json={"name": f"if-match-{uuid4().hex}", "definition": {}},
        ).json()["data"]
        missing = client.patch(
            f"/api/v1/agents/{created['id']}",
            headers=headers,
            json={"definition": {"changed": True}},
        )
        assert missing.status_code == 428
        assert missing.json()["error"]["code"] == "PRECONDITION_REQUIRED"


def test_agent_update_rejects_stale_if_match_with_412():
    with TestClient(app) as client:
        headers = _auth_headers(client)
        created = client.post(
            "/api/v1/agents",
            headers=headers,
            json={"name": f"if-match-{uuid4().hex}", "definition": {}},
        ).json()["data"]
        stale = client.patch(
            f"/api/v1/agents/{created['id']}",
            headers={**headers, "If-Match": '"999"'},
            json={"definition": {"changed": True}},
        )
        assert stale.status_code == 412
        assert stale.json()["error"]["code"] == "PRECONDITION_FAILED"
