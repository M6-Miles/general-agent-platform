"""Small sliding-window limiter with tenant-aware accounting."""

import logging
from collections import defaultdict, deque
from threading import Lock
from time import monotonic, time

try:
    from redis import Redis
except ImportError:  # pragma: no cover
    Redis = None

logger = logging.getLogger(__name__)


class RateLimiter:
    def __init__(self, limit: int = 120, window_seconds: int = 60, redis_url: str | None = None):
        self.limit = limit
        self.window_seconds = window_seconds
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()
        self._redis = Redis.from_url(redis_url, socket_connect_timeout=0.2, socket_timeout=0.2) if Redis is not None and redis_url else None

    def _check_redis(self, key: str, effective_limit: int, consume: bool = True) -> tuple[bool, int, int] | None:
        if self._redis is None:
            return None
        reset = self.window_seconds - int(time()) % self.window_seconds
        bucket = int(time()) // self.window_seconds
        redis_key = f"agent-runtime:rate-limit:{key}:{bucket}"
        try:
            if consume:
                pipeline = self._redis.pipeline(transaction=True)
                pipeline.incr(redis_key)
                pipeline.expire(redis_key, self.window_seconds + 1)
                count, _ = pipeline.execute()
            else:
                count = int(self._redis.get(redis_key) or 0)
        except Exception:  # noqa: BLE001 - local limiter remains a fail-open fallback
            # IMPORTANT: Multi-replica deployment caveat:
            # When Redis is unavailable, each API process maintains its own local counter.
            # In a multi-replica deployment (e.g., 3 replicas), the effective rate limit
            # becomes 3x the configured limit (each replica allows full limit independently).
            # This is an intentional fail-open strategy to maintain availability.
            # For strict rate limiting in production, ensure Redis availability or configure
            # a gateway-level rate limiter (e.g., nginx, API gateway) as a backstop.
            logger.warning("Redis unavailable for rate limiting - falling back to local counter (multi-replica caveat applies)")
            return None
        return count <= effective_limit, max(0, effective_limit - count), reset

    def check(self, key: str, now: float | None = None, limit: int | None = None, consume: bool = True) -> tuple[bool, int, int]:
        current = monotonic() if now is None else now
        effective_limit = self.limit if limit is None else limit
        if effective_limit <= 0:
            return True, 0, self.window_seconds
        if now is None:
            distributed = self._check_redis(key, effective_limit, consume=consume)
            if distributed is not None:
                return distributed
        with self._lock:
            events = self._events[key]
            cutoff = current - self.window_seconds
            while events and events[0] <= cutoff:
                events.popleft()
            allowed = len(events) < effective_limit
            if allowed and consume:
                events.append(current)
            return allowed, max(0, effective_limit - len(events)), self.window_seconds

    def reset(self) -> None:
        if self._redis is not None:
            try:
                keys = list(self._redis.scan_iter("agent-runtime:rate-limit:*", count=1000))
                if keys:
                    self._redis.delete(*keys)
            except Exception:
                logger.debug("Failed to clear Redis rate-limit buckets", exc_info=True)
        with self._lock:
            self._events.clear()
