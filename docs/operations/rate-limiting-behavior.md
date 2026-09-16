# Rate Limiting Behavior in Multi-Replica Deployments

## Overview

The Agent Runtime platform uses a Redis-backed sliding window rate limiter with a local in-memory fallback. This document explains the behavior and implications for multi-replica deployments.

## Normal Operation (Redis Available)

When Redis is available:
- All API replicas share the same distributed rate limit counter
- A limit of 120 requests per minute is enforced globally across all replicas
- Example: With 3 replicas and a 120 req/min limit, all replicas together allow max 120 req/min

## Fallback Behavior (Redis Unavailable)

When Redis is unavailable or unreachable:
- **Each replica maintains its own local in-memory counter**
- **The effective rate limit multiplies by the number of replicas**
- This is an **intentional fail-open strategy** to maintain availability

### Multi-Replica Caveat

**Important**: In a multi-replica deployment, if Redis fails, the actual rate limit becomes:

```text
effective_limit = configured_limit × number_of_replicas
```

**Example**:
- Configured limit: 120 requests/minute
- Replicas: 3
- Redis status: Unavailable
- **Actual limit**: 360 requests/minute (each replica independently allows 120)

## Production Recommendations

### 1. Ensure Redis High Availability

For strict rate limiting in production:
- Deploy Redis with replication (master-replica setup)
- Use Redis Sentinel for automatic failover
- Consider Redis Cluster for horizontal scaling
- Monitor Redis availability and alert on failures

### 2. Gateway-Level Rate Limiting

Configure a backstop rate limiter at the API gateway or load balancer level:

**Nginx example**:
```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=120r/m;

server {
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://backend;
    }
}
```

**AWS API Gateway**:
- Configure throttle limits at the API Gateway level
- Set per-client rate limits using API keys or usage plans

**Kong API Gateway**:
```yaml
plugins:
  - name: rate-limiting
    config:
      minute: 120
      policy: redis
      redis_host: redis.example.com
      fault_tolerant: false  # Enforce strict limits even if Redis fails
```

### 3. Monitoring and Alerting

Monitor the following metrics:
- `rate_limit_redis_failures_total`: Count of Redis connection failures
- `rate_limit_fallback_active`: Boolean indicating if fallback is active
- Redis availability and response time

Set alerts for:
- Redis unavailability lasting > 1 minute
- Sustained increase in rate limit fallback usage

## Configuration

Rate limiting is configured via environment variables:

```bash
# Enable/disable rate limiting
RATE_LIMIT_ENABLED=true

# Default rate limit (requests per minute)
RATE_LIMIT_DEFAULT=120

### Login protection

登录失败使用独立的 15 分钟滑动窗口，不消耗租户 API 配额：

- 同一 IP：最多 30 次失败
- 同一账号：最多 10 次失败
- 同一 IP + 账号组合：最多 5 次失败

超出阈值返回 `429 LOGIN_RATE_LIMITED` 和 `Retry-After` 响应头。已识别租户会记录
`user.login_rate_limited` 审计事件；IP 仅以 SHA-256 摘要参与限流，不写入明文审计数据。

# Redis connection
REDIS_URL=redis://localhost:6379/0
```

## Code Reference

Rate limiter implementation: [app/middleware/rate_limit.py](../../app/middleware/rate_limit.py)

Key behavior:
- Line 35-36: Fallback to local counter on Redis failure
- Line 23-36: Distributed rate limiting logic
- Line 48-55: Local sliding window implementation

## Trade-offs

### Fail-Open Strategy (Current)

**Pros**:
- Maintains API availability during Redis outages
- Graceful degradation
- No hard failures for legitimate users

**Cons**:
- Effective rate limit multiplies by replica count
- Potential for abuse during Redis outages
- Less predictable rate limiting

### Fail-Closed Strategy (Alternative)

To implement strict rate limiting even when Redis fails, modify the fallback behavior:

```python
# In rate_limit.py, line 35
except Exception:
    # Fail closed: reject requests when Redis unavailable
    logger.error("Redis unavailable - enforcing strict rate limit denial")
    return False, 0, self.window_seconds
```

**Pros**:
- Strict rate limit enforcement
- Prevents abuse during outages

**Cons**:
- API becomes unavailable when Redis fails
- Single point of failure
- Poor user experience during outages

## Recommendations by Deployment Type

### Development/Testing
- Local Redis instance
- Fail-open strategy is acceptable

### Staging
- Redis replica set
- Gateway-level rate limiting optional
- Monitor for Redis failures

### Production
- **Required**: Redis Cluster or Sentinel setup
- **Required**: Gateway-level rate limiting as backstop
- **Required**: Monitoring and alerting on Redis availability
- Consider fail-closed strategy if abuse is a primary concern

## Related Documentation

- [Secret Manager Integration](./secret-manager-integration.md)
- [Release Checklist](../delivery/release-checklist.md)
- [Operations Runbook](../runbooks/operations.md)
