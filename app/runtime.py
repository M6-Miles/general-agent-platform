import re
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeoutError
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from jsonschema import Draft202012Validator, SchemaError
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.events import record_runtime_event
from app.models import Approval, Run, RuntimeSnapshot, ToolCall, ToolDefinition, WorkflowNode
from app.observability import observe_tool_error
from app.security_utils import redact_json

TOOL_TERMINAL = {"succeeded", "rejected", "expired", "permanently_failed", "timed_out"}
RUN_TERMINAL = {"completed", "failed", "cancelled", "timed_out", "budget_exceeded"}
RUN_TRANSITIONS = {
    "accepted": {"preparing", "cancelled", "stopping"},
    "preparing": {"running", "failed", "cancelled", "stopping"},
    "running": {"waiting_approval", "completed", "failed", "cancelled", "stopping", "timed_out", "budget_exceeded"},
    "stopping": {"cancelled"},
    "waiting_approval": {"running", "failed", "cancelled", "stopping", "timed_out"},
}


def persist_workflow_node(db: Session, run: Run, node: dict[str, Any], *, status: str | None = None) -> WorkflowNode:
    """Persist the latest state of one node for a concrete Run execution."""
    stored = db.query(WorkflowNode).filter(
        WorkflowNode.tenant_id == run.tenant_id,
        WorkflowNode.workflow_id == run.id,
        WorkflowNode.node_key == node["key"],
    ).first()
    node_status = status or node.get("status", "pending")
    config = {key: value for key, value in node.items() if key not in {"status", "output", "depends_on"}}
    if stored is None:
        stored = WorkflowNode(
            tenant_id=run.tenant_id,
            workflow_id=run.id,
            node_key=node["key"],
            node_type=node["type"],
            config_json=config,
            depends_on=node.get("depends_on", []),
            status=node_status,
            output_json=node.get("output"),
        )
        db.add(stored)
    else:
        stored.config_json = config
        stored.depends_on = node.get("depends_on", [])
        stored.status = node_status
        stored.output_json = node.get("output")
    db.flush()
    return stored


def transition_run(db: Session, run, next_status: str, *, expected_status: str | None = None, payload: dict[str, Any] | None = None) -> bool:
    """Apply a documented Run transition once and append its durable event."""
    current = run.status
    if expected_status is not None and current != expected_status:
        return False
    if current == next_status:
        return True
    if next_status not in RUN_TRANSITIONS.get(current, set()):
        raise ValueError("INVALID_STATE_TRANSITION")
    # Flush checkpoint writes before the compare-and-set transition.
    db.flush()
    result = db.execute(
        update(type(run))
        .where(
            type(run).id == run.id,
            type(run).status == current,
            type(run).attempt_id == run.attempt_id,
            type(run).checkpoint_version == run.checkpoint_version,
        )
        .values(status=next_status)
    )
    if result.rowcount != 1:
        raise ValueError("VERSION_CONFLICT")
    run.status = next_status
    record_runtime_event(db, run=run, event_type=f"run.{next_status}", payload={"status": next_status, **(payload or {})})
    return True


def begin_new_attempt(db: Session, run, *, checkpoint_version: int | None = None, event_type: str = "run.replayed", payload: dict[str, Any] | None = None) -> str:
    """Atomically reopen a terminal run under a fresh attempt identifier."""
    if run.status not in RUN_TERMINAL | {"waiting_approval"}:
        raise ValueError("RUN_NOT_REPLAYABLE")
    old_attempt = run.attempt_id
    new_attempt = str(uuid4())
    target_version = run.checkpoint_version if checkpoint_version is None else checkpoint_version
    db.flush()
    result = db.execute(
        update(type(run))
        .where(
            type(run).id == run.id,
            type(run).status == run.status,
            type(run).attempt_id == old_attempt,
            type(run).checkpoint_version == run.checkpoint_version,
        )
        .values(status="accepted", attempt_id=new_attempt, checkpoint_version=target_version, finished_at=None)
    )
    if result.rowcount != 1:
        raise ValueError("VERSION_CONFLICT")
    run.status = "accepted"
    run.attempt_id = new_attempt
    run.checkpoint_version = target_version
    run.finished_at = None
    record_runtime_event(db, run=run, event_type=event_type, payload={"status": "accepted", "attempt_id": new_attempt, **(payload or {})})
    return new_attempt


def execute_builtin(executor: str, payload: dict[str, Any]) -> dict[str, Any]:
    if executor == "builtin.echo":
        return {"value": payload.get("value")}
    if executor == "builtin.add":
        left, right = payload.get("left"), payload.get("right")
        if not isinstance(left, (int, float)) or not isinstance(right, (int, float)):
            raise ValueError("INVALID_TOOL_INPUT")
        return {"sum": left + right}
    raise ValueError("TOOL_EXECUTOR_NOT_ALLOWED")


def mock_model(prompt: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"text": f"mock:{prompt}", "context_keys": sorted((context or {}).keys()), "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}}


def validate_json_schema(value: Any, schema: dict[str, Any], error_code: str) -> None:
    """Validate a tool payload against its declared schema with stable runtime errors."""
    if not schema:
        return
    try:
        validator = Draft202012Validator(schema)
    except SchemaError as exc:
        raise ValueError("INVALID_TOOL_SCHEMA") from exc
    error = next(validator.iter_errors(value), None)
    if error is not None:
        raise ValueError(error_code)


def validate_workflow(nodes: list[dict[str, Any]]) -> None:
    keys = {node.get("key") for node in nodes}
    if None in keys or len(keys) != len(nodes):
        raise ValueError("INVALID_WORKFLOW")
    for node in nodes:
        if node.get("type") not in {"start", "prepare", "model", "tool", "condition", "finalize", "end"}:
            raise ValueError("INVALID_WORKFLOW_NODE")
        if node.get("type") == "condition":
            required_fields = {"condition_type", "left", "operator", "right", "true_next", "false_next"}
            if not required_fields <= node.keys():
                raise ValueError("INVALID_WORKFLOW_CONDITION")
            if node["true_next"] not in keys or node["false_next"] not in keys:
                raise ValueError("INVALID_WORKFLOW_CONDITION")
        if any(dep not in keys for dep in node.get("depends_on", [])):
            raise ValueError("INVALID_WORKFLOW_DEPENDENCY")
    indegree = {key: 0 for key in keys}
    children = {key: [] for key in keys}
    for node in nodes:
        for dep in node.get("depends_on", []):
            indegree[node["key"]] += 1
            children[dep].append(node["key"])
    queue = [key for key, degree in indegree.items() if degree == 0]
    visited = 0
    while queue:
        key = queue.pop(0)
        visited += 1
        for child in children[key]:
            indegree[child] -= 1
            if indegree[child] == 0:
                queue.append(child)
    if visited != len(nodes):
        raise ValueError("INVALID_WORKFLOW_CYCLE")


def branch_excluded_keys(nodes: list[dict[str, Any]], condition_key: str, excluded_root: str) -> set[str]:
    """Return the branch-only nodes that must be skipped after a condition decision."""
    by_key = {node["key"]: node for node in nodes}
    excluded = {excluded_root}
    changed = True
    while changed:
        changed = False
        for node in nodes:
            if node["key"] in excluded or node["key"] == condition_key:
                continue
            dependencies = set(node.get("depends_on", []))
            if not dependencies or not dependencies.intersection(excluded):
                continue
            if dependencies <= excluded | {condition_key}:
                excluded.add(node["key"])
                changed = True
    return {key for key in excluded if key in by_key}


def condition_route(node: dict[str, Any], context: dict[str, Any]) -> tuple[bool, str | None]:
    """Evaluate a condition node and return its result and selected successor."""
    condition = node.get("when") or {
        "left": node.get("left"),
        "operator": node.get("operator"),
        "right": node.get("right"),
    }
    matched = condition_matches(condition, context)
    return matched, node.get("true_next" if matched else "false_next")


def order_workflow(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    validate_workflow(nodes)
    remaining = {node["key"]: node for node in nodes}
    # Condition edges are scheduling dependencies even when the persisted DAG
    # omits them from depends_on for editor compatibility.
    virtual_deps = {
        node["key"]: set(node.get("depends_on", []))
        | {parent["key"] for parent in nodes if parent.get("type") == "condition" and node["key"] in {parent.get("true_next"), parent.get("false_next")}}
        for node in nodes
    }
    completed: set[str] = set()
    ordered: list[dict[str, Any]] = []
    while remaining:
        ready = [node for node in remaining.values() if virtual_deps[node["key"]] <= completed]
        if not ready:
            raise ValueError("INVALID_WORKFLOW_CYCLE")
        for node in sorted(ready, key=lambda item: item["key"]):
            ordered.append(node)
            completed.add(node["key"])
            remaining.pop(node["key"])
    return ordered


def condition_matches(condition: dict[str, Any] | None, context: dict[str, Any]) -> bool:
    if not condition:
        return True
    if "field" in condition and "equals" in condition:
        left = context.get(condition["field"]) if isinstance(condition.get("field"), str) else None
        operator = "equals"
        right = condition["equals"]
    else:
        operator = condition.get("operator")
        if not isinstance(operator, str) or operator not in {"equals", "not_equals", "contains", "not_contains", "greater_than", "less_than", "regex_match"}:
            raise ValueError("INVALID_WORKFLOW_CONDITION")
        left = context.get(condition["left"]) if isinstance(condition.get("left"), str) else condition.get("left")
        right = condition.get("right")
    if operator == "equals":
        return left == right
    if operator == "not_equals":
        return left != right
    if operator == "contains":
        return right in left if isinstance(left, (str, list, tuple, set, dict)) else False
    if operator == "not_contains":
        return right not in left if isinstance(left, (str, list, tuple, set, dict)) else True
    if operator == "greater_than":
        try:
            return left > right
        except TypeError:
            return False
    if operator == "less_than":
        try:
            return left < right
        except TypeError:
            return False
    if not isinstance(left, str) or not isinstance(right, str) or len(right) > 256 or re.search(r"\([^)]*[+*][^)]*\)[+*]", right):
        raise ValueError("INVALID_WORKFLOW_CONDITION")
    try:
        compiled = re.compile(right)
    except re.error as exc:
        raise ValueError("INVALID_WORKFLOW_CONDITION") from exc
    executor = ThreadPoolExecutor(max_workers=1)
    try:
        return bool(executor.submit(compiled.search, left).result(timeout=0.1))
    except FutureTimeoutError as exc:
        raise ValueError("WORKFLOW_CONDITION_TIMEOUT") from exc
    finally:
        executor.shutdown(wait=False, cancel_futures=True)


def execute_tool_call(db: Session, call: ToolCall, definition: ToolDefinition) -> ToolCall:
    if call.status in TOOL_TERMINAL:
        return call
    run = db.query(Run).filter(Run.id == call.run_id, Run.tenant_id == call.tenant_id).first()
    snapshot = db.query(RuntimeSnapshot).filter(RuntimeSnapshot.run_id == call.run_id, RuntimeSnapshot.tenant_id == call.tenant_id).first()
    if run is None or definition.tenant_id != call.tenant_id or definition.status != "active":
        call.status = "permanently_failed"; call.error_code = "TOOL_NOT_ALLOWED"; db.flush(); return call
    policies = snapshot.tool_policies_json if snapshot is not None else []
    matching = [policy for policy in policies if policy.get("tool") in {definition.name, "*"}]
    if policies and not matching:
        call.status = "rejected"; call.error_code = "TOOL_POLICY_DENIED"; call.finished_at = datetime.now(UTC); db.flush(); return call
    if matching:
        policy = matching[-1]
        denied = policy.get("effect", "allow") != "allow" or (definition.side_effects and not policy.get("allowSideEffects", False)) or definition.risk_level not in policy.get("allowedRisks", ["low"])
        if denied:
            call.status = "rejected"; call.error_code = "TOOL_POLICY_DENIED"; call.finished_at = datetime.now(UTC); db.flush(); return call
    call.status = "validating"
    db.flush()
    call.status = "executing"
    call.started_at = datetime.now(UTC)
    max_attempts = max(1, min(5, int((definition.manifest_json or {}).get("maxAttempts", 1))))
    retryable = set((definition.manifest_json or {}).get("retryableErrors", ["TOOL_EXECUTION_TRANSIENT"]))
    for attempt in range(call.attempt, max_attempts + 1):
        call.attempt = attempt
        executor = ThreadPoolExecutor(max_workers=1)
        try:
            validate_json_schema(call.input_json, definition.input_schema or {}, "INVALID_TOOL_INPUT")
            future = executor.submit(execute_builtin, definition.executor, call.input_json)
            output = future.result(timeout=definition.timeout_ms / 1000)
            validate_json_schema(output, definition.output_schema or {}, "INVALID_TOOL_OUTPUT")
        except FutureTimeoutError:
            call.status = "timed_out"; call.error_code = "SANDBOX_TIMEOUT"; call.output_json = None; break
        except ValueError as exc:
            call.error_code = str(exc)
            if str(exc) in retryable and attempt < max_attempts:
                call.status = "retry_scheduled"; continue
            call.status = "permanently_failed"; break
        else:
            call.output_json = redact_json(output); call.status = "succeeded"; call.error_code = None; break
        finally:
            executor.shutdown(wait=False, cancel_futures=True)
    call.finished_at = datetime.now(UTC)
    if call.status not in {"succeeded", "executing"}:
        observe_tool_error(definition.name, call.error_code or call.status)
    db.flush()
    return call


def expire_pending_approvals(db: Session, *, tenant_id: str | None = None) -> int:
    now = datetime.now(UTC)
    query = db.query(Approval).filter(Approval.status == "pending", Approval.used_at.is_(None), Approval.expires_at <= now)
    if tenant_id is not None:
        query = query.filter(Approval.tenant_id == tenant_id)
    approvals = query.with_for_update().all()
    for approval in approvals:
        approval.status = "expired"; approval.used_at = now; approval.decision_reason = "APPROVAL_EXPIRED"
        call = db.get(ToolCall, approval.tool_call_id)
        if call is not None and call.status == "pending_approval":
            call.status = "expired"; call.error_code = "APPROVAL_EXPIRED"; call.finished_at = now
        run = db.get(Run, approval.run_id)
        if run is not None and run.status == "waiting_approval":
            transition_run(db, run, "failed", payload={"reason": "APPROVAL_EXPIRED"}); run.finished_at = now
    if approvals:
        db.flush()
    return len(approvals)
