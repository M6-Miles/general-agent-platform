#!/usr/bin/env python3
"""Small dependency-free HTTP baseline load test for local acceptance."""
import concurrent.futures
import json
import time
from collections import Counter
from urllib.request import Request, urlopen

BASE_URL = "http://127.0.0.1:8000"


def request(path: str) -> tuple[int, float, str]:
    started = time.perf_counter()
    try:
        with urlopen(Request(BASE_URL + path), timeout=10) as response:
            return response.status, time.perf_counter() - started, "ok"
    except Exception as exc:  # noqa: BLE001
        return 0, time.perf_counter() - started, type(exc).__name__


def run(name: str, path: str, count: int, workers: int) -> dict:
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        results = list(pool.map(request, [path] * count))
    latencies = sorted(item[1] * 1000 for item in results)
    statuses = Counter(item[0] or item[2] for item in results)
    percentile = lambda p: latencies[min(len(latencies) - 1, int(len(latencies) * p / 100))]
    return {"name": name, "requests": count, "success_rate": round(sum(item[0] == 200 for item in results) / count * 100, 2), "p50_ms": round(percentile(50), 2), "p95_ms": round(percentile(95), 2), "p99_ms": round(percentile(99), 2), "statuses": dict(statuses)}


if __name__ == "__main__":
    print(json.dumps([run("health-100", "/health", 100, 100), run("health-mixed-50", "/health", 50, 50)], indent=2))
