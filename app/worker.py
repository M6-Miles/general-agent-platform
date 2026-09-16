"""Redis Streams worker with database polling fallback."""

import hashlib
import json
import logging
import os
import secrets
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread

from sqlalchemy import text

from app.audit import record_audit
from app.db import SessionLocal
from app.events import record_runtime_event
from app.models import (
    Agent,
    Approval,
    Checkpoint,
    Run,
    RuntimeSnapshot,
    Tenant,
    TenantQuota,
    ToolCall,
    ToolDefinition,
    WorkflowInstance,
)
from app.observability import (
    increment,
    observe_parallel_duration,
    observe_run_duration,
    prometheus_lines,
    set_gauge,
    timer,
)
from app.providers import get_model_provider
from app.quota import soft_limit_reached, tenant_usage
from app.runtime import (
    condition_matches,
    condition_route,
    execute_tool_call,
    expire_pending_approvals,
    order_workflow,
    persist_workflow_node,
    transition_run,
)
from app.security_utils import redact_json

try:
    from redis import Redis
except ImportError:  # pragma: no cover
    Redis = None

STREAM = "agent-runtime:runs"
DEAD_LETTER_STREAM = "agent-runtime:runs:dead-letter"
GROUP = "agent-runtime-workers"
logger = logging.getLogger(__name__)

# Import settings with secrets support
try:
    from app.config_secrets import get_settings_with_secrets
    settings = get_settings_with_secrets()
except ImportError:
    from app.config import get_settings
    settings = get_settings()
TASK_LOCK_TTL = 300
MAX_WORKFLOW_NODES = 100
MAX_WORKFLOW_STEPS = 1000
MAX_TOOL_CALLS = 50
MAX_PARALLEL_NODES = 5


class _MetricsHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path != "/metrics":
            self.send_error(404)
            return
        payload = ("\n".join(prometheus_lines()) + "\n").encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; version=0.0.4")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, _format: str, *_args: object) -> None:
        return


def start_metrics_server() -> ThreadingHTTPServer:
    port = int(os.getenv("WORKER_METRICS_PORT", "8001"))
    server = ThreadingHTTPServer(("0.0.0.0", port), _MetricsHandler)
    Thread(target=server.serve_forever, daemon=True, name="worker-metrics").start()
    return server


def _prepare_parallel_results(ordered: list[dict], context: dict) -> None:
    """Compute independent non-Tool nodes concurrently; persist them serially later."""
    depths: dict[str, int] = {}
    for node in ordered:
        depths[node["key"]] = 1 + max((depths.get(dep, 0) for dep in node.get("depends_on", [])), default=0)
    groups: dict[int, list[dict]] = {}
    for node in ordered:
        if node.get("type") not in {"model", "prepare", "finalize"}:
            continue
        if any(parent.get("type") == "condition" and node["key"] in {parent.get("true_next"), parent.get("false_next")} for parent in ordered):
            continue
        groups.setdefault(depths[node["key"]], []).append(node)
    for batch in (group for group in groups.values() if len(group) > 1):
        started = timer()
        with ThreadPoolExecutor(max_workers=min(MAX_PARALLEL_NODES, len(batch))) as pool:
            futures = {pool.submit(complete_model, str(node.get("prompt", context.get("prompt", ""))), dict(context)): node for node in batch if node.get("type") == "model"}
            for future in as_completed(futures):
                futures[future]["_parallel_result"] = future.result()
            for node in batch:
                if node.get("type") in {"prepare", "finalize"}:
                    node["_parallel_result"] = ({"status": "succeeded"}, {})
        increment("workflow_parallel_nodes_total", len(batch))
        observe_parallel_duration(timer() - started)


def _redis_client():
    if Redis is None:
        return None
    return Redis.from_url(
        settings.redis_url,
        decode_responses=True,
        socket_connect_timeout=0.5,
        socket_timeout=2.0,
    )


@contextmanager
def with_task_lock(run_id: str, timeout: int = TASK_LOCK_TTL):
    """Acquire a per-Run Redis lock; no Redis means local DB fallback remains active."""
    client = _redis_client()
    if client is None:
        yield True
        return
    key = f"agent-runtime:task-lock:{run_id}"
    value = f"{os.getpid()}:{secrets.token_hex(8)}"
    try:
        acquired = client.set(key, value, nx=True, ex=timeout)
    except Exception:  # noqa: BLE001 - DB polling remains the fallback
        logger.warning("redis task lock unavailable for %s; using DB claim", run_id)
        yield True
        return
    if not acquired:
        yield False
        return
    try:
        yield True
    finally:
        try:
            if client.get(key) == value:
                client.delete(key)
        except Exception:  # noqa: BLE001 - lock cleanup must not crash worker
            logger.warning("task lock cleanup failed for %s", run_id)


def recover_stuck_runs(db, stale_seconds: int = 600) -> int:
    """Re-queue running Runs whose worker lock expired."""
    cutoff = datetime.now(UTC) - timedelta(seconds=stale_seconds)
    client = _redis_client()
    recovered = 0
    query = db.query(Run).filter(Run.status == "running", Run.updated_at < cutoff)
    for run in query.with_for_update().all():
        if client is not None:
            try:
                if client.exists(f"agent-runtime:task-lock:{run.id}"):
                    continue
            except Exception as e:  # noqa: BLE001 - DB recovery remains available
                logger.warning("unable to inspect task lock for %s: %s", run.id, e)
        run.status = "accepted"
        recovered += 1
    return recovered


def recover_approval_waiting(db) -> int:
    """Resume approved waits and fail rejected waits after a worker restart."""
    changed = 0
    for run in db.query(Run).filter(Run.status == "waiting_approval").with_for_update().all():
        approval = db.query(Approval).filter(Approval.run_id == run.id).order_by(Approval.created_at.desc()).first()
        if approval is None:
            continue
        if approval.status == "approved":
            run.status = "accepted"
            changed += 1
        elif approval.status in {"rejected", "expired"}:
            run.status = "cancelled"
            run.finished_at = datetime.now(UTC)
            changed += 1
    return changed
_model_failures = 0


def complete_model(prompt: str, context: dict) -> tuple[dict, dict]:
    """Call the provider with bounded retries and a small process-local circuit breaker."""
    global _model_failures
    if _model_failures >= settings.model_circuit_threshold:
        raise ValueError("MODEL_CIRCUIT_OPEN")
    started = time.perf_counter()
    last_error: ValueError | None = None
    for attempt in range(settings.model_max_retries + 1):
        try:
            result = get_model_provider(settings).complete(prompt, context)
            _model_failures = 0
            usage = result.get("usage") or {}
            input_tokens = int(usage.get("prompt_tokens", 0) or 0)
            output_tokens = int(usage.get("completion_tokens", 0) or 0)
            cost = input_tokens / 1000 * settings.model_cost_per_1k_input_usd + output_tokens / 1000 * settings.model_cost_per_1k_output_usd
            return result, {"attempts": attempt + 1, "latency_ms": round((time.perf_counter() - started) * 1000, 2), "model": settings.model_name, "prompt_tokens": input_tokens, "completion_tokens": output_tokens, "total_tokens": int(usage.get("total_tokens", input_tokens + output_tokens) or 0), "estimated_cost_usd": round(cost, 8)}
        except ValueError as exc:
            last_error = exc
            retryable = str(exc) in {"MODEL_PROVIDER_TRANSIENT", "MODEL_PROVIDER_UNAVAILABLE"}
            if retryable:
                _model_failures += 1
            if retryable and attempt < settings.model_max_retries:
                time.sleep(min(2 ** attempt, 4))
    raise last_error or ValueError("MODEL_PROVIDER_UNAVAILABLE")


def execute_workflow(db, run: Run, agent: Agent) -> str:
    """Execute a workflow in the durable worker transaction."""
    snapshot = db.query(RuntimeSnapshot).filter(RuntimeSnapshot.run_id == run.id, RuntimeSnapshot.tenant_id == run.tenant_id).first()
    definition = snapshot.definition_json if snapshot is not None else (agent.definition or {})
    raw_workflow = definition.get("workflow", [])
    if isinstance(raw_workflow, dict):
        workflow = raw_workflow.get("nodes", [])
        stored_edges = raw_workflow.get("edges", [])
        if isinstance(workflow, list) and isinstance(stored_edges, list):
            dependencies: dict[str, list[str]] = {}
            for edge in stored_edges:
                if not isinstance(edge, dict) or not edge.get("source") or not edge.get("target"):
                    continue
                dependencies.setdefault(str(edge["target"]), []).append(str(edge["source"]))
            workflow = [
                {
                    **node,
                    "key": str(node.get("key") or node.get("id")),
                    "depends_on": node.get("depends_on") or dependencies.get(str(node.get("key") or node.get("id")), []),
                }
                for node in workflow
                if isinstance(node, dict) and (node.get("key") or node.get("id"))
            ]
    else:
        workflow = raw_workflow
    if not workflow:
        # Agents created by older UI builds may not contain an explicit
        # workflow.  Fall back to a single model step so their instructions
        # still produce a real answer instead of a misleading empty success.
        instructions = definition.get("instructions") or definition.get("systemPrompt") or definition.get("system_prompt")
        if instructions:
            workflow = [
                {
                    "key": "model",
                    "type": "model",
                    "label": "模型（1）",
                    "prompt": f"{instructions}\n\n用户问题：{{prompt}}",
                    "depends_on": [],
                }
            ]
        else:
            return "ok"
    # Initialize these before validation so early workflow errors (for example,
    # a dependency cycle) can still be persisted by the failure handler.
    ordered: list[dict] = []
    context = dict(run.input_json or {})
    try:
        ordered = order_workflow(workflow)
        if len(ordered) > MAX_WORKFLOW_NODES:
            run.output_json = {"error": "WORKFLOW_NODE_LIMIT_EXCEEDED", "max_nodes": MAX_WORKFLOW_NODES}
            return "failed"
        if run.status != "stopping" and not any(node.get("type") == "condition" for node in ordered):
            _prepare_parallel_results(ordered, context)
        steps = 0
        tool_calls = 0
        selected_next: dict[str, str] = {}
        condition_parents = {
            node["key"]: [parent["key"] for parent in ordered if parent.get("type") == "condition" and node["key"] in {parent.get("true_next"), parent.get("false_next")}]
            for node in ordered
        }
        # Build dependency graph to track all descendants of condition branches
        descendants_map: dict[str, set[str]] = {node["key"]: set() for node in ordered}
        for node in ordered:
            for dep in node.get("depends_on", []):
                if dep in descendants_map:
                    descendants_map[dep].add(node["key"])

        # Function to get all transitive descendants
        def get_all_descendants(key: str, visited: set[str] | None = None) -> set[str]:
            if visited is None:
                visited = set()
            if key in visited:
                return set()
            visited.add(key)
            result = descendants_map.get(key, set()).copy()
            for child in list(result):
                result.update(get_all_descendants(child, visited))
            return result

        # Track which nodes are excluded by condition branches
        branch_excluded_keys: set[str] = set()

        for node in ordered:
            steps += 1
            if steps > MAX_WORKFLOW_STEPS:
                run.output_json = {"error": "WORKFLOW_STEP_LIMIT_EXCEEDED", "max_steps": MAX_WORKFLOW_STEPS}
                return "failed"
            if run.status == "stopping":
                run.output_json = {"error": "STOP_REQUESTED", "completed_steps": steps - 1}
                return "stopped"
            budget = run.budget_json or {}
            usage = run.usage_json or {}
            quota = db.get(TenantQuota, run.tenant_id)
            if quota is not None and soft_limit_reached(quota, tenant_usage(db, run.tenant_id)) and node.get("type") == "tool":
                run.output_json = {"error": "QUOTA_SOFT_LIMIT", "usage": usage}
                return "budget_exceeded"
            if int(budget.get("max_tokens", 0) or 0) and int(usage.get("total_tokens", 0)) >= int(budget["max_tokens"]):
                run.output_json = {"error": "BUDGET_EXCEEDED", "usage": usage}
                return "budget_exceeded"
            if float(budget.get("max_cost_usd", 0) or 0) and float(run.cost_usd or 0) >= float(budget["max_cost_usd"]):
                run.output_json = {"error": "BUDGET_EXCEEDED", "usage": usage, "cost_usd": run.cost_usd}
                return "budget_exceeded"
            parents = condition_parents[node["key"]]
            if parents and not any(selected_next.get(parent) == node["key"] for parent in parents):
                node["status"] = "skipped"
                persist_workflow_node(db, run, node)
                continue
            # Skip nodes excluded by condition branches (including descendants)
            if node["key"] in branch_excluded_keys:
                node["status"] = "skipped"
                persist_workflow_node(db, run, node)
                continue
            if not condition_matches(node.get("when"), context):
                node["status"] = "skipped"
                persist_workflow_node(db, run, node)
                continue
            node["status"] = "running"
            persist_workflow_node(db, run, node)
            if node["type"] == "model":
                result = node.pop("_parallel_result", None)
                if result is None:
                    prompt = str(node.get("prompt", context.get("prompt", "")))
                    prompt = prompt.replace("{prompt}", str(context.get("prompt", "")))
                    result = complete_model(prompt, context)
                node["output"], node["model_metrics"] = result
                metrics = node["model_metrics"]
                run.usage_json = {
                    **(run.usage_json or {}),
                    "prompt_tokens": int((run.usage_json or {}).get("prompt_tokens", 0)) + metrics["prompt_tokens"],
                    "completion_tokens": int((run.usage_json or {}).get("completion_tokens", 0)) + metrics["completion_tokens"],
                    "total_tokens": int((run.usage_json or {}).get("total_tokens", 0)) + metrics["total_tokens"],
                }
                run.cost_usd = float(run.cost_usd or 0) + metrics["estimated_cost_usd"]
                context[node["key"]] = node["output"]
            elif node["type"] == "condition":
                matched, selected = condition_route(node, context)
                node["output"] = {"matched": matched}
                selected_next[node["key"]] = selected
                context[node["key"]] = node["output"]
                # Mark all descendants of non-selected branches as excluded
                for branch_key in {node.get("true_next"), node.get("false_next")} - {selected}:
                    if branch_key:
                        branch_excluded_keys.add(branch_key)
                        branch_excluded_keys.update(get_all_descendants(branch_key))
            elif node["type"] in {"start", "prepare", "finalize", "end"}:
                node["output"] = node.pop("_parallel_result", ({"status": "succeeded"}, {}))[0]
                context[node["key"]] = node["output"]
            elif node["type"] == "tool":
                tool_calls += 1
                if tool_calls > MAX_TOOL_CALLS:
                    run.output_json = {"error": "TOOL_CALL_LIMIT_EXCEEDED", "max_tool_calls": MAX_TOOL_CALLS}
                    return "budget_exceeded"
                node_config = node.get("config") if isinstance(node.get("config"), dict) else {}
                tool_id = node.get("tool_id") or node_config.get("tool_id")
                tool_name = node.get("tool_name") or node.get("tool") or node_config.get("tool_name") or node_config.get("tool")
                tool_query = db.query(ToolDefinition).filter(
                    ToolDefinition.tenant_id == run.tenant_id,
                    ToolDefinition.status == "active",
                )
                if tool_id:
                    tool_query = tool_query.filter(ToolDefinition.id == str(tool_id))
                else:
                    tool_query = tool_query.filter(ToolDefinition.name == tool_name)
                definition = tool_query.order_by(ToolDefinition.version.desc()).first()
                if definition is None:
                    raise ValueError("TOOL_NOT_FOUND")
                tool_name = definition.name
                tool_input = node.get("input", node_config.get("input", context))
                args_hash = hashlib.sha256(json.dumps(tool_input, sort_keys=True, separators=(",", ":")).encode()).hexdigest()[:8]
                idem = f"{definition.id}:{args_hash}:{run.id}"
                call = db.query(ToolCall).filter(ToolCall.tenant_id == run.tenant_id, ToolCall.idempotency_key == idem).first()
                if call is None:
                    initial_status = "pending_approval" if definition.risk_level in {"high", "critical"} else "created"
                    call = ToolCall(tenant_id=run.tenant_id, run_id=run.id, tool_definition_id=definition.id, input_json=redact_json(tool_input), idempotency_key=idem, status=initial_status)
                    db.add(call)
                    db.flush()
                    if initial_status == "pending_approval":
                        raw_token = secrets.token_urlsafe(32)
                        db.add(Approval(tenant_id=run.tenant_id, run_id=run.id, tool_call_id=call.id, token_hash=hashlib.sha256(raw_token.encode()).hexdigest(), snapshot_id=run.snapshot_id, expires_at=datetime.now(UTC) + timedelta(minutes=15)))
                        record_runtime_event(
                            db,
                            run=run,
                            event_type="tool.approval.required",
                            payload={"tool_call_id": call.id, "approval_token": raw_token},
                        )
                if call.status == "pending_approval":
                    persist_workflow_node(db, run, node, status="waiting_approval")
                    return "waiting"
                execute_tool_call(db, call, definition)
                if call.status != "succeeded":
                    raise ValueError(call.error_code or "TOOL_EXECUTION_FAILED")
                node["output"] = call.output_json
                context[node["key"]] = call.output_json
            node["status"] = "succeeded"
            persist_workflow_node(db, run, node)
        db.add(Checkpoint(tenant_id=run.tenant_id, run_id=run.id, attempt_id=run.attempt_id, snapshot_id=run.snapshot_id, version=run.checkpoint_version + 1, state_json={"workflow": ordered, "context": context}, usage_json=run.usage_json or {}))
        run.checkpoint_version += 1
        run.output_json = {"workflow": ordered, "context": context}
        return "ok"
    except (ValueError, TypeError) as exc:
        # Preserve the latest durable state so failed runs can be resumed from
        # a checkpoint instead of losing all progress before the failing node.
        db.add(Checkpoint(
            tenant_id=run.tenant_id,
            run_id=run.id,
            attempt_id=run.attempt_id,
            snapshot_id=run.snapshot_id,
            version=run.checkpoint_version + 1,
            state_json={"workflow": ordered, "context": context},
            usage_json=run.usage_json or {},
        ))
        run.checkpoint_version += 1
        run.output_json = {"error": str(exc)}
        return "failed"


def sync_workflow_instance(db, run: Run) -> None:
    instances = db.query(WorkflowInstance).filter(WorkflowInstance.run_id == run.id, WorkflowInstance.tenant_id == run.tenant_id).all()
    for instance in instances:
        instance.status = run.status
        instance.output_json = run.output_json


def process_once(run_id: str | None = None, tenant_id: str | None = None) -> int:
    with SessionLocal() as db:
        if db.bind is not None and db.bind.dialect.name == "postgresql" and not tenant_id:
            tenant_ids = [item[0] for item in db.query(Tenant.id).filter(Tenant.status == "active").all()]
            for candidate in tenant_ids:
                processed = process_once(run_id=run_id, tenant_id=candidate)
                if processed:
                    return processed
            return 0
        if db.bind is not None and db.bind.dialect.name == "postgresql":
            db.info["tenant_id"] = tenant_id
            db.execute(text("SELECT set_config('app.tenant_id', :tenant_id, true)"), {"tenant_id": tenant_id})
        recover_stuck_runs(db)
        recover_approval_waiting(db)
        db.commit()
        set_gauge("approval_pending_count", db.query(Approval).filter(Approval.status == "pending").count())
        set_gauge("worker_queue_depth", db.query(Run).filter(Run.status.in_(("accepted", "preparing", "running", "stopping"))).count())
        expire_pending_approvals(db)
        db.commit()
        query = db.query(Run).filter(Run.status.in_(("accepted", "preparing", "running", "stopping")))
        if run_id:
            query = query.filter(Run.id == run_id)
        # Resume interrupted work before taking newer queued work.
        run = query.order_by((Run.status == "running").desc(), Run.created_at).with_for_update().first()
        if run is None:
            return 0
        with with_task_lock(run.id) as acquired:
            if not acquired:
                return 0
            return _process_claimed_run(db, run)


def _process_claimed_run(db, run) -> int:
        """Process one DB-claimed run while its distributed lock is held."""
        started_at = timer()
        increment("worker_runs_claimed")
        if run.status == "stopping":
            transition_run(db, run, "cancelled", payload={"reason": "STOP_REQUESTED"})
            run.output_json = {"error": "STOP_REQUESTED", "completed_steps": 0}
            run.finished_at = datetime.now(UTC)
            sync_workflow_instance(db, run)
            db.commit()
            return 1
        if run.status in {"preparing", "running"}:
            checkpoint = db.query(Checkpoint).filter(Checkpoint.run_id == run.id, Checkpoint.tenant_id == run.tenant_id).order_by(Checkpoint.version.desc()).first()
            if checkpoint is not None:
                run.checkpoint_version = checkpoint.version
                run.output_json = {"recovered_from": checkpoint.version}
            run.status = "accepted"
        transition_run(db, run, "preparing")
        db.flush()
        transition_run(db, run, "running")
        agent = db.get(Agent, run.agent_id)
        workflow_result = "failed" if agent is None else execute_workflow(db, run, agent)
        if workflow_result == "waiting":
            transition_run(db, run, "waiting_approval")
            sync_workflow_instance(db, run)
            observe_run_duration(timer() - started_at, run.status)
            db.commit()
            return 1
        if workflow_result == "failed":
            transition_run(db, run, "failed")
            run.finished_at = datetime.now(UTC)
            sync_workflow_instance(db, run)
            observe_run_duration(timer() - started_at, run.status)
            record_audit(db, tenant_id=run.tenant_id, actor_id=run.created_by, action="run.failed", resource_type="run", resource_id=run.id, request_id=f"worker:{run.id}", metadata={"worker": "workflow"})
            db.commit()
            return 1
        if workflow_result == "stopped":
            transition_run(db, run, "cancelled")
            run.finished_at = datetime.now(UTC)
            sync_workflow_instance(db, run)
            record_audit(db, tenant_id=run.tenant_id, actor_id=run.created_by, action="run.stopped", resource_type="run", resource_id=run.id, request_id=f"worker:{run.id}", metadata={"reason": "STOP_REQUESTED"})
            db.commit()
            return 1
        if workflow_result == "budget_exceeded":
            transition_run(db, run, "budget_exceeded")
            run.finished_at = datetime.now(UTC)
            sync_workflow_instance(db, run)
            observe_run_duration(timer() - started_at, run.status)
            record_audit(db, tenant_id=run.tenant_id, actor_id=run.created_by, action="run.budget_exceeded", resource_type="run", resource_id=run.id, request_id=f"worker:{run.id}", metadata={"usage": run.usage_json, "costUsd": run.cost_usd})
            db.commit()
            return 1
        pending = db.query(ToolCall).filter(ToolCall.run_id == run.id, ToolCall.status == "pending_approval").first()
        if pending is not None:
            transition_run(db, run, "waiting_approval")
            sync_workflow_instance(db, run)
            db.commit()
            return 1
        calls = db.query(ToolCall).filter(ToolCall.run_id == run.id, ToolCall.status == "created").all()
        for call in calls:
            definition = db.get(ToolDefinition, call.tool_definition_id)
            if definition is None:
                call.status = "permanently_failed"
                call.error_code = "TOOL_NOT_FOUND"
                transition_run(db, run, "failed")
                break
            execute_tool_call(db, call, definition)
            if call.status != "succeeded":
                transition_run(db, run, "failed")
                break
        else:
            transition_run(db, run, "completed")
        run.finished_at = datetime.now(UTC)
        sync_workflow_instance(db, run)
        observe_run_duration(timer() - started_at, run.status)
        record_audit(db, tenant_id=run.tenant_id, actor_id=run.created_by, action=f"run.{run.status}", resource_type="run", resource_id=run.id, request_id=f"worker:{run.id}", metadata={"worker": "database-poll"})
        db.commit()
        increment("worker_runs_completed" if run.status == "completed" else "worker_runs_failed")
        return 1


def publish_run(run_id: str, tenant_id: str = "") -> None:
    client = _redis_client()
    if client is None:
        return
    try:
        client.xgroup_create(STREAM, GROUP, id="0", mkstream=True)
    except Exception as exc:  # noqa: BLE001 - tolerate Redis group race/unavailability
        logger.debug("redis group already exists or unavailable: %s", exc)
    client.xadd(STREAM, {"run_id": run_id, "tenant_id": tenant_id}, maxlen=10000, approximate=True)


def process_stream_once() -> int:
    client = _redis_client()
    if client is None:
        return 0
    try:
        try:
            client.xgroup_create(STREAM, GROUP, id="0", mkstream=True)
        except Exception as exc:
            if "BUSYGROUP" not in str(exc):
                raise
        messages = client.xreadgroup(GROUP, os.getenv("WORKER_ID", "worker-1"), {STREAM: ">"}, count=10, block=1000)
    except Exception as exc:  # noqa: BLE001 - polling fallback handles unavailable Redis
        logger.warning("redis stream unavailable: %s", exc)
        return 0
    processed = 0
    for _, entries in messages:
        for message_id, values in entries:
            run_id = str(values.get("run_id") or "").strip()
            if not run_id:
                logger.error("redis stream message %s has no run_id; leaving unacked", message_id)
                continue
            try:
                processed_run = process_once(run_id=run_id, tenant_id=str(values.get("tenant_id") or "") or None)
                if processed_run == 0:
                    logger.warning("redis stream run %s is not currently claimable; leaving message %s unacked", run_id, message_id)
                    continue
            except Exception:
                logger.exception("run processing failed; moving message to dead letter stream")
                try:
                    client.xadd(DEAD_LETTER_STREAM, {"run_id": values.get("run_id", ""), "tenant_id": values.get("tenant_id", ""), "source_id": message_id, "error": "WORKER_UNHANDLED_ERROR"}, maxlen=10000, approximate=True)
                except Exception:
                    logger.exception("dead letter publish failed")
            client.xack(STREAM, GROUP, message_id)
            processed += 1
    return processed


def main() -> None:
    start_metrics_server()
    while True:
        processed = process_stream_once() or process_once()
        if processed == 0:
            time.sleep(1)


if __name__ == "__main__":
    main()
