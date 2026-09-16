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


def test_cursor_pagination_empty_and_last_page_have_no_cursor():
    with TestClient(app) as client:
        headers = _auth_headers(client)
        first = client.get("/api/v1/agents?limit=100", headers=headers)
        assert first.status_code == 200
        assert first.json()["meta"]["next_cursor"] is None

        for index in range(3):
            created = client.post(
                "/api/v1/agents",
                headers=headers,
                json={"name": f"pagination-{uuid4().hex}-{index}", "definition": {}},
            )
            assert created.status_code == 201
        page = client.get("/api/v1/agents?limit=2", headers=headers)
        assert page.status_code == 200
        cursor = page.json()["meta"]["next_cursor"]
        assert cursor
        last = client.get(f"/api/v1/agents?limit=100&cursor={cursor}", headers=headers)
        assert last.status_code == 200
        assert last.json()["meta"]["next_cursor"] is None


def test_cursor_pagination_rejects_invalid_base64_json():
    with TestClient(app) as client:
        response = client.get("/api/v1/agents?cursor=%%%", headers=_auth_headers(client))
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"
