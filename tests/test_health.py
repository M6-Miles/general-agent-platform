from fastapi.testclient import TestClient

from app.main import app


def test_health_and_ready():
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        assert client.get("/ready").status_code == 200


def test_metrics_exposes_request_and_process_metrics():
    with TestClient(app) as client:
        response = client.get("/metrics")
        assert response.status_code == 200
        assert "agent_http_requests_total" in response.text
        assert "agent_process_uptime_seconds" in response.text
