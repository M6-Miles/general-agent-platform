from threading import Thread

from fastapi.testclient import TestClient

from app.main import app
from app.providers import MockModelProvider
from app.worker import process_once
from tests.test_runtime import auth_headers


def test_mock_provider_stream_yields_text_chunks():
    chunks = list(MockModelProvider().complete_stream("hello", {}))
    assert chunks
    assert "".join(chunks)


def test_execute_stream_returns_sse_lifecycle_events():
    with TestClient(app) as client:
        headers = auth_headers(client)
        agent = client.post("/api/v1/agents", headers=headers, json={"name": "stream-agent", "definition": {}}).json()["data"]
        assert client.post(f"/api/v1/agents/{agent['id']}/publish", headers=headers).status_code == 201
        run = client.post("/api/v1/runs", headers=headers, json={"agent_id": agent["id"], "input": {}}).json()["data"]
        worker = Thread(target=process_once, kwargs={"run_id": run["id"]})
        worker.start()
        response = client.post(f"/api/v1/runs/{run['id']}/execute-stream", headers=headers)
        worker.join(timeout=5)
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        assert "event: run.accepted" in response.text


def test_execute_stream_emits_node_events():
    with TestClient(app) as client:
        headers = auth_headers(client)
        agent = client.post("/api/v1/agents", headers=headers, json={"name": "stream-workflow-agent", "definition": {"workflow": [{"key": "prepare", "type": "prepare"}]}}).json()["data"]
        assert client.post(f"/api/v1/agents/{agent['id']}/publish", headers=headers).status_code == 201
        run = client.post("/api/v1/runs", headers=headers, json={"agent_id": agent["id"], "input": {}}).json()["data"]
        worker = Thread(target=process_once, kwargs={"run_id": run["id"]})
        worker.start()
        response = client.post(f"/api/v1/runs/{run['id']}/execute-stream", headers=headers)
        worker.join(timeout=5)
        assert "event: run.accepted" in response.text
