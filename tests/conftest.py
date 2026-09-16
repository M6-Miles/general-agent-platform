import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-characters")
# Tests must be hermetic even when a developer shell exports the production
# Docker database URL. Each pytest process gets its own SQLite file.
os.environ["DATABASE_URL"] = f"sqlite:///./data/test-{os.getpid()}.db"
os.environ["MODEL_PROVIDER"] = "mock"
os.environ["EMBEDDING_PROVIDER"] = "mock"

from app.db import Base, SessionLocal, engine
from app.dependencies import _RATE_LIMITER
from app.models import TenantQuota


@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """Create one predictable database after pytest has loaded its configuration."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def isolate_tenant_quota():
    """Prevent quota mutations in one test from throttling later tests."""
    with SessionLocal() as db:
        db.query(TenantQuota).update(
            {
                TenantQuota.monthly_token_limit: 0,
                TenantQuota.monthly_cost_limit_usd: 0,
                TenantQuota.max_concurrent_runs: 0,
                TenantQuota.max_requests_per_minute: 120,
                TenantQuota.max_knowledge_documents: 0,
                TenantQuota.max_workflow_runs_per_day: 0,
            },
            synchronize_session=False,
        )
        db.commit()
    _RATE_LIMITER.reset()
