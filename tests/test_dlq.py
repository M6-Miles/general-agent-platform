from fastapi.testclient import TestClient

from app.main import app


def headers(client: TestClient) -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "ChangeMe123456!"})
    if response.status_code == 401:
        from scripts.seed import main
        main()
        response = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "ChangeMe123456!"})
    return {"Authorization": f"Bearer {response.json()['data']['access_token']}"}


def test_dlq_requires_authentication():
    with TestClient(app) as client:
        assert client.get("/api/v1/dlq").status_code == 401


def test_dlq_degrades_cleanly_without_redis(monkeypatch):
    import app.main as main_module
    monkeypatch.setattr(main_module, "Redis", None)
    with TestClient(app) as client:
        auth = headers(client)
        response = client.get("/api/v1/dlq", headers=auth)
        assert response.status_code == 200
        assert response.json()["data"] == []
        replay = client.post("/api/v1/dlq/1-0/replay", headers=auth)
        assert replay.status_code == 503


def test_dlq_hides_other_tenants_and_legacy_entries(monkeypatch):
    from app.db import SessionLocal
    from app.models import Tenant

    with SessionLocal() as db:
        demo_tenant_id = db.query(Tenant.id).filter(Tenant.slug == "demo").scalar()

    class FakeRedis:
        @classmethod
        def from_url(cls, _url, **_kwargs):
            return cls()

        def xrevrange(self, _stream, count=100):
            return [
                ("1-0", {"run_id": "visible", "tenant_id": demo_tenant_id}),
                ("2-0", {"run_id": "foreign", "tenant_id": "another-tenant"}),
                ("3-0", {"run_id": "legacy"}),
            ]

        def xrange(self, _stream, min, max, count=1):
            if min == "2-0" and max == "2-0":
                return [("2-0", {"run_id": "foreign", "tenant_id": "another-tenant"})]
            return []

    monkeypatch.setattr("app.main.Redis", FakeRedis)
    with TestClient(app) as client:
        auth = headers(client)
        listed = client.get("/api/v1/dlq", headers=auth)
        assert listed.status_code == 200
        assert [item["message_id"] for item in listed.json()["data"]] == ["1-0"]
        assert client.post("/api/v1/dlq/2-0/replay", headers=auth).status_code == 404
