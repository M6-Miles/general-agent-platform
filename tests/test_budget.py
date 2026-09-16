from fastapi.testclient import TestClient

from app.main import app
from tests.test_runtime import auth_headers


def test_stop_endpoint_requests_graceful_cancellation():
    with TestClient(app) as client:
        headers = auth_headers(client)
        agent = client.post("/api/v1/agents", headers=headers, json={"name": "stop-budget-agent", "definition": {}}).json()["data"]
        assert client.post(f"/api/v1/agents/{agent['id']}/publish", headers=headers).status_code == 201
        run = client.post("/api/v1/runs", headers=headers, json={"agent_id": agent["id"], "input": {}}).json()["data"]
        response = client.post(f"/api/v1/runs/{run['id']}/stop", headers=headers)
        assert response.status_code == 200
        assert response.json()["data"]["status"] == "stopping"
        repeat = client.post(f"/api/v1/runs/{run['id']}/stop", headers=headers)
        assert repeat.status_code == 200
