from fastapi.testclient import TestClient

from app.main import app
from tests.test_runtime import auth_headers


def test_execute_async_keeps_request_non_blocking_contract():
    with TestClient(app) as client:
        headers = auth_headers(client)
        agent = client.post(
            "/api/v1/agents",
            headers=headers,
            json={"name": "async-agent", "definition": {}},
        ).json()["data"]
        assert client.post(f"/api/v1/agents/{agent['id']}/publish", headers=headers).status_code == 201
        run = client.post(
            "/api/v1/runs",
            headers=headers,
            json={"agent_id": agent["id"], "input": {}},
        ).json()["data"]

        response = client.post(f"/api/v1/runs/{run['id']}/execute?async=true", headers=headers)

        assert response.status_code == 202
        assert response.json()["data"]["id"] == run["id"]
        assert response.json()["data"]["status"] in {"accepted", "preparing", "running", "completed"}
