from collections import defaultdict
from time import perf_counter

_counters: dict[str, int] = defaultdict(int)
_latency_sum: dict[str, float] = defaultdict(float)
_histogram: dict[str, list[float]] = defaultdict(list)
_gauges: dict[str, float] = defaultdict(float)
_gauges.update({"approval_pending_count": 0, "worker_queue_depth": 0, "db_connections_active": 0})
_gauges["websocket_connections_active"] = 0


def observe_request(path: str, elapsed_seconds: float) -> None:
    key = path.replace("/", "_") or "root"
    _counters[f"http_requests_{key}"] += 1
    _latency_sum[key] += elapsed_seconds


def increment(name: str, amount: int = 1) -> None:
    _counters[name] += amount


def observe_run_duration(duration_seconds: float, status: str) -> None:
    _histogram[f"run_duration_seconds|{status}"].append(max(0.0, duration_seconds))


def observe_tool_error(tool_name: str, error_type: str) -> None:
    _counters[f"tool_call_errors_total|{tool_name}|{error_type}"] += 1


def observe_model_api(latency_seconds: float) -> None:
    """Record model provider latency in a Prometheus histogram."""
    _histogram["model_api_latency_seconds|all"].append(max(0.0, latency_seconds))


def observe_rag_query(latency_seconds: float) -> None:
    """Record end-to-end knowledge-base query latency."""
    _histogram["rag_query_latency_seconds|all"].append(max(0.0, latency_seconds))


def observe_document_import(duration_seconds: float) -> None:
    """Record document ingestion and embedding duration."""
    _histogram["rag_document_import_duration_seconds|all"].append(max(0.0, duration_seconds))


def observe_embedding_cache_hit() -> None:
    _counters["rag_embedding_cache_hits_total"] += 1


def observe_parallel_duration(duration_seconds: float) -> None:
    """Record the duration of a parallel workflow batch."""
    _histogram["workflow_parallel_duration_seconds|all"].append(max(0.0, duration_seconds))


def record_model_usage(total_tokens: int, cost_usd: float) -> None:
    _counters["run_tokens_total"] += max(0, int(total_tokens))
    _counters["run_cost_cents"] += max(0, round(float(cost_usd) * 100))


def observe_websocket_connection(delta: int) -> None:
    _gauges["websocket_connections_active"] = max(0, _gauges["websocket_connections_active"] + delta)


def set_gauge(name: str, value: float) -> None:
    _gauges[name] = value


def prometheus_lines() -> list[str]:
    lines = []
    for name, value in sorted(_counters.items()):
        metric = "agent_" + name
        lines.extend([f"# TYPE {metric} counter", f"{metric} {value}"])
    for path, value in sorted(_latency_sum.items()):
        metric = "agent_http_request_duration_seconds_sum"
        lines.append(f'{metric}{{path="{path}"}} {value:.6f}')
    for key, values in sorted(_histogram.items()):
        metric, status = key.split("|", 1)
        for bound in (1, 5, 10, 30, 60, 120, 300, 600, 1800, 3600):
            lines.append(f'{"agent_" + metric}_bucket{{status="{status}",le="{bound}"}} {sum(value <= bound for value in values)}')
        lines.append(f'{"agent_" + metric}_count{{status="{status}"}} {len(values)}')
        lines.append(f'{"agent_" + metric}_sum{{status="{status}"}} {sum(values):.6f}')
    for key, value in sorted(_gauges.items()):
        lines.extend([f"# TYPE agent_{key} gauge", f"agent_{key} {value}"])
    return lines


def timer():
    return perf_counter()
