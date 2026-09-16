from datetime import UTC, datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Run, TenantQuota


def month_key(moment: datetime | None = None) -> str:
    return (moment or datetime.now(UTC)).astimezone(UTC).strftime("%Y-%m")


def quota_redis_key(tenant_id: str, moment: datetime | None = None) -> str:
    return f"quota:{tenant_id}:{month_key(moment)}"


def increment_quota(redis_client, tenant_id: str, amount: int, moment: datetime | None = None) -> int:
    """Atomically increment a monthly counter using Redis INCRBY."""
    return int(redis_client.incrby(quota_redis_key(tenant_id, moment), amount))


def tenant_usage(db: Session, tenant_id: str) -> dict[str, float | int]:
    month_start = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    total_tokens, cost_usd, run_count = db.query(
        func.coalesce(func.sum(Run.usage_json["total_tokens"].as_integer()), 0),
        func.coalesce(func.sum(Run.cost_usd), 0.0),
        func.count(Run.id),
    ).filter(Run.tenant_id == tenant_id, Run.created_at >= month_start).one()
    return {
        "total_tokens": int(total_tokens or 0),
        "cost_usd": round(float(cost_usd or 0), 8),
        "run_count": int(run_count or 0),
        "active_runs": db.query(func.count(Run.id)).filter(
            Run.tenant_id == tenant_id,
            Run.status.in_(("accepted", "preparing", "running", "waiting_approval")),
        ).scalar() or 0,
    }


def soft_limit_reached(quota: TenantQuota, usage: dict[str, float | int]) -> bool:
    ratio = max(0, min(100, int(quota.warning_percent or 90))) / 100
    token_limit = int(quota.monthly_token_limit or 0)
    cost_limit = float(quota.monthly_cost_limit_usd or 0)
    token_hit = token_limit > 0 and usage["total_tokens"] >= token_limit * ratio
    cost_hit = cost_limit > 0 and usage["cost_usd"] >= cost_limit * ratio
    return bool(token_hit or cost_hit)
