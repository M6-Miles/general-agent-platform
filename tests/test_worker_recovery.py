from datetime import UTC, datetime, timedelta

from app.db import SessionLocal
from app.models import Approval
from app.worker import recover_approval_waiting, recover_stuck_runs, with_task_lock
from tests.test_worker import create_run


class FakeRedis:
    def __init__(self):
        self.values = {}

    def set(self, key, value, nx=False, ex=None):
        if nx and key in self.values:
            return False
        self.values[key] = value
        return True

    def get(self, key):
        return self.values.get(key)

    def delete(self, key):
        self.values.pop(key, None)

    def exists(self, key):
        return key in self.values


def test_task_lock_rejects_second_holder(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr("app.worker._redis_client", lambda: fake)
    with with_task_lock("run-1") as acquired:
        assert acquired
        with with_task_lock("run-1") as second:
            assert not second
    assert fake.values == {}


def test_recover_stuck_run_when_lock_expired(monkeypatch):
    monkeypatch.setattr("app.worker._redis_client", lambda: None)
    with SessionLocal() as db:
        _, _, _, run = create_run(db, status="running")
        run.updated_at = datetime.now(UTC) - timedelta(minutes=15)
        db.commit()
        assert recover_stuck_runs(db) == 1
        assert run.status == "accepted"


def test_recover_approval_waiting_approved_and_rejected():
    with SessionLocal() as db:
        tenant, _, _, approved_run = create_run(db, status="waiting_approval")
        db.add(Approval(tenant_id=tenant.id, run_id=approved_run.id, tool_call_id="missing-call", status="approved", expires_at=datetime.now(UTC) + timedelta(minutes=5)))
        tenant2, _, _, rejected_run = create_run(db, status="waiting_approval")
        db.add(Approval(tenant_id=tenant2.id, run_id=rejected_run.id, tool_call_id="missing-call-2", status="rejected", expires_at=datetime.now(UTC) + timedelta(minutes=5)))
        db.commit()
        assert recover_approval_waiting(db) == 2
        assert approved_run.status == "accepted"
        assert rejected_run.status == "cancelled"
