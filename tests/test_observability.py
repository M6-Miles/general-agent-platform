from app.observability import (
    observe_document_import,
    observe_embedding_cache_hit,
    observe_model_api,
    observe_rag_query,
    observe_websocket_connection,
    prometheus_lines,
    record_model_usage,
)


def _metric_value(lines: list[str], name: str) -> int:
    prefix = f"{name} "
    return int(next((line.removeprefix(prefix) for line in lines if line.startswith(prefix)), "0"))


def test_model_metrics_are_recorded_and_exported():
    before = prometheus_lines()
    tokens_before = _metric_value(before, "agent_run_tokens_total")
    cost_before = _metric_value(before, "agent_run_cost_cents")
    observe_model_api(0.012)
    record_model_usage(42, 0.37)
    lines = prometheus_lines()
    output = "\n".join(lines)
    assert "agent_model_api_latency_seconds_count" in output
    assert _metric_value(lines, "agent_run_tokens_total") - tokens_before == 42
    assert _metric_value(lines, "agent_run_cost_cents") - cost_before == 37


def test_websocket_active_gauge_tracks_connections():
    observe_websocket_connection(2)
    try:
        output = "\n".join(prometheus_lines())
        assert "agent_websocket_connections_active 2" in output
    finally:
        observe_websocket_connection(-2)


def test_rag_metrics_are_recorded_and_exported():
    observe_rag_query(0.025)
    observe_document_import(0.5)
    observe_embedding_cache_hit()
    output = "\n".join(prometheus_lines())
    assert "agent_rag_query_latency_seconds_count" in output
    assert "agent_rag_document_import_duration_seconds_count" in output
    assert "agent_rag_embedding_cache_hits_total" in output


def test_rag_latency_metrics_clamp_negative_values():
    observe_rag_query(-1)
    observe_document_import(-1)
    output = "\n".join(prometheus_lines())
    assert "agent_rag_query_latency_seconds_count{status=\"all\"}" in output
    assert "agent_rag_document_import_duration_seconds_count{status=\"all\"}" in output
    assert "-1.000000" not in output


def test_embedding_cache_hit_counter_is_monotonic():
    observe_embedding_cache_hit()
    output = "\n".join(prometheus_lines())
    assert "agent_rag_embedding_cache_hits_total" in output
