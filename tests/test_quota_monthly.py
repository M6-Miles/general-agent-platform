from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.main import app
from app.models import TenantQuota
from app.quota import increment_quota, month_key, quota_redis_key, soft_limit_reached


class FakeRedis:
    def __init__(self):
        self.values = {}

    def incrby(self, key, amount):
        self.values[key] = self.values.get(key, 0) + amount
        return self.values[key]


def test_month_key_uses_utc_calendar_boundary():
    assert month_key(datetime(2026, 12, 31, 23, 59, tzinfo=UTC)) == "2026-12"
    assert month_key(datetime(2027, 1, 1, 0, 0, tzinfo=UTC)) == "2027-01"
    assert quota_redis_key("tenant-a", datetime(2027, 1, 1, tzinfo=UTC)) == "quota:tenant-a:2027-01"


def test_increment_quota_uses_atomic_incrby_and_soft_limit():
    redis = FakeRedis()
    assert increment_quota(redis, "tenant-a", 40) == 40
    assert increment_quota(redis, "tenant-a", 50) == 90
    quota = TenantQuota(tenant_id="tenant-a", monthly_token_limit=100, warning_percent=90)
    assert soft_limit_reached(quota, {"total_tokens": 90, "cost_usd": 0}) is True


def test_quota_management_api_for_current_tenant():
    with TestClient(app) as client:
        from scripts.seed import main

        main()
        login = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "ChangeMe123456!"}).json()
        headers = {"Authorization": f"Bearer {login['data']['access_token']}"}
        tenant_id = login["data"]["user"]["tenant_id"]
        updated = client.put(f"/api/v1/tenants/{tenant_id}/quota", headers=headers, json={"monthly_token_limit": 1000, "monthly_cost_limit_usd": 5, "max_concurrent_runs": 4, "warning_percent": 90})
        assert updated.status_code == 200
        assert updated.json()["data"]["monthly_token_limit"] == 1000
        fetched = client.get(f"/api/v1/tenants/{tenant_id}/quota", headers=headers)
        assert fetched.status_code == 200
        assert fetched.json()["data"]["usage"]["run_count"] >= 0
