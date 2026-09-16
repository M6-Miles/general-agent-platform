from fastapi.testclient import TestClient

from app.main import app
from app.middleware.rate_limit import RateLimiter


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


def test_sliding_window_allows_limit_then_rejects_and_expires():
    limiter = RateLimiter(limit=2, window_seconds=60)
    assert limiter.check("tenant", now=100)[0] is True
    assert limiter.check("tenant", now=101)[0] is True
    allowed, remaining, reset = limiter.check("tenant", now=102)
    assert allowed is False
    assert remaining == 0
    assert reset == 60
    assert limiter.check("tenant", now=161)[0] is True


def test_limits_are_isolated_by_key():
    limiter = RateLimiter(limit=1)
    assert limiter.check("a", now=1)[0] is True
    assert limiter.check("a", now=2)[0] is False
    assert limiter.check("b", now=2)[0] is True


def test_api_exposes_rate_limit_contract_headers():
    with TestClient(app) as client:
        response = client.get("/api/v1/agents", headers=_auth_headers(client))
        assert response.status_code == 200
        assert int(response.headers["X-RateLimit-Limit"]) > 0
        assert 0 <= int(response.headers["X-RateLimit-Remaining"]) < int(response.headers["X-RateLimit-Limit"])
        assert int(response.headers["X-RateLimit-Reset"]) >= 0
