from fastapi.testclient import TestClient

from app.main import app


def test_tenant_quota_exposes_request_and_resource_limits():
    from scripts.seed import main

    main()
    with TestClient(app) as client:
        login = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "ChangeMe123456!"}).json()
        headers = {"Authorization": f"Bearer {login['data']['access_token']}"}
        tenant_id = login["data"]["user"]["tenant_id"]
        response = client.put(
        f"/api/v1/tenants/{tenant_id}/quota",
        headers=headers,
        json={
            "monthly_token_limit": 0,
            "monthly_cost_limit_usd": 0,
            "max_concurrent_runs": 0,
            "max_requests_per_minute": 3,
            "max_knowledge_documents": 2,
            "max_workflow_runs_per_day": 4,
        },
        )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["max_requests_per_minute"] == 3
    assert data["max_knowledge_documents"] == 2
    assert data["max_workflow_runs_per_day"] == 4
