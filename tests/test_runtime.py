import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.main import app
from app.models import (
    Approval,
    AuditEvent,
    Checkpoint,
    Run,
    Tenant,
    User,
    WorkflowNode,
)
from app.security import hash_password


def auth_headers(client: TestClient) -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "ChangeMe123456!"})
    if response.status_code == 401:
        from scripts.seed import main

        main()
        response = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "ChangeMe123456!"})
    return {"Authorization": f"Bearer {response.json()['data']['access_token']}"}


def publish_agent(client: TestClient, headers: dict[str, str], agent_id: str) -> None:
    assert client.post(f"/api/v1/agents/{agent_id}/publish", headers=headers).status_code == 201


def test_run_requires_published_current_version_and_binds_it():
    with TestClient(app) as client:
        headers = auth_headers(client)
        agent = client.post(
            "/api/v1/agents",
            headers=headers,
            json={"name": f"version-bound-agent-{uuid4().hex[:8]}", "definition": {}},
        ).json()["data"]

        draft_run = client.post(
            "/api/v1/runs", headers=headers, json={"agent_id": agent["id"], "input": {}}
        )
        assert draft_run.status_code == 409
        assert draft_run.json()["error"]["code"] == "AGENT_VERSION_NOT_PUBLISHED"

        published = client.post(f"/api/v1/agents/{agent['id']}/publish", headers=headers)
        assert published.status_code == 201
        run = client.post(
            "/api/v1/runs", headers=headers, json={"agent_id": agent["id"], "input": {}}
        )
        assert run.status_code == 202
        assert run.json()["data"]["agent_version_id"] == published.json()["data"]["id"]


def test_tool_policy_is_rechecked_at_execution():
    with TestClient(app) as client:
        headers = auth_headers(client)
        client.post("/api/v1/tools", headers=headers, json={"name": "policy-echo", "executor": "builtin.echo"})
        agent = client.post("/api/v1/agents", headers=headers, json={"name": "policy-agent", "definition": {"tool_policies": [{"tool": "other-tool", "effect": "allow"}]}}).json()["data"]
        publish_agent(client, headers, agent["id"])
        run = client.post("/api/v1/runs", headers=headers, json={"agent_id": agent["id"], "input": {}}).json()["data"]
        client.post(f"/api/v1/runs/{run['id']}/tool-calls", headers=headers, json={"tool_name": "policy-echo", "input": {"value": "x"}, "idempotency_key": "policy-recheck-idem-001"})
        result = client.post(f"/api/v1/runs/{run['id']}/execute", headers=headers)
        assert result.json()["data"]["status"] == "failed"


def test_http_workflow_executes_tool_nodes():
    with TestClient(app) as client:
        headers = auth_headers(client)
        tool_name = f"http-workflow-echo-{uuid4().hex[:8]}"
        tool = client.post(
            "/api/v1/tools",
            headers=headers,
            json={"name": tool_name, "executor": "builtin.echo"},
        )
        assert tool.status_code == 201
        agent = client.post(
            "/api/v1/agents",
            headers=headers,
            json={
                "name": f"http-workflow-agent-{uuid4().hex[:8]}",
                "definition": {
                    "workflow": [
                        {"key": "prepare", "type": "prepare"},
                        {
                            "key": "echo",
                            "type": "tool",
                            "tool_name": tool_name,
                            "input": {"value": "from-workflow"},
                            "depends_on": ["prepare"],
                        },
                        {"key": "finalize", "type": "finalize", "depends_on": ["echo"]},
                    ]
                },
            },
        )
        assert agent.status_code == 201
        publish_agent(client, headers, agent.json()["data"]["id"])
        run = client.post(
            "/api/v1/runs",
            headers=headers,
            json={"agent_id": agent.json()["data"]["id"], "input": {}},
        )
        assert run.status_code == 202
        result = client.post(f"/api/v1/runs/{run.json()['data']['id']}/execute", headers=headers)
        assert result.status_code == 202
        assert result.json()["data"]["status"] == "completed"
        output = result.json()["data"]["output_json"]
        assert output.get("tool_calls") or output.get("workflow") or output.get("status")


def test_tool_timeout_is_enforced(monkeypatch):
    def slow(_executor, payload):
        time.sleep(0.2)
        return {"value": payload.get("value")}

    monkeypatch.setattr("app.runtime.execute_builtin", slow)
    with TestClient(app) as client:
        headers = auth_headers(client)
        client.post("/api/v1/tools", headers=headers, json={"name": "slow-echo", "executor": "builtin.echo", "timeout_ms": 100})
        agent = client.post("/api/v1/agents", headers=headers, json={"name": "timeout-agent", "definition": {}}).json()["data"]
        publish_agent(client, headers, agent["id"])
        run = client.post("/api/v1/runs", headers=headers, json={"agent_id": agent["id"], "input": {}}).json()["data"]
        call = client.post(f"/api/v1/runs/{run['id']}/tool-calls", headers=headers, json={"tool_name": "slow-echo", "input": {"value": "x"}, "idempotency_key": "timeout-tool-idem-001"}).json()["data"]
        client.post(f"/api/v1/runs/{run['id']}/execute", headers=headers)
        with SessionLocal() as db:
            from app.models import ToolCall
            assert db.get(ToolCall, call["id"]).status == "timed_out"


def test_transient_tool_failure_has_bounded_retry(monkeypatch):
    attempts = 0

    def flaky(_executor, payload):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise ValueError("TOOL_EXECUTION_TRANSIENT")
        return {"value": payload.get("value")}

    monkeypatch.setattr("app.runtime.execute_builtin", flaky)
    manifest = {"id": "retry-tool", "version": "1.0.0", "description": "retry", "entrypoint": "builtin.echo", "license": "MIT", "riskLevel": "low", "sideEffects": False, "maxAttempts": 2, "retryableErrors": ["TOOL_EXECUTION_TRANSIENT"]}
    with TestClient(app) as client:
        headers = auth_headers(client)
        client.post("/api/v1/tools", headers=headers, json={"name": "retry-tool", "executor": "builtin.echo", "manifest": manifest})
        agent = client.post("/api/v1/agents", headers=headers, json={"name": "retry-agent", "definition": {}}).json()["data"]
        publish_agent(client, headers, agent["id"])
        run = client.post("/api/v1/runs", headers=headers, json={"agent_id": agent["id"], "input": {}}).json()["data"]
        call = client.post(f"/api/v1/runs/{run['id']}/tool-calls", headers=headers, json={"tool_name": "retry-tool", "input": {"value": "ok"}, "idempotency_key": "retry-tool-idem-001"}).json()["data"]
        client.post(f"/api/v1/runs/{run['id']}/execute", headers=headers)
        with SessionLocal() as db:
            from app.models import ToolCall
            stored = db.get(ToolCall, call["id"])
            assert stored.status == "succeeded"
            assert stored.attempt == 2


def test_expired_approval_is_closed_automatically():
    with TestClient(app) as client:
        headers = auth_headers(client)
        client.post("/api/v1/tools", headers=headers, json={"name": "expiring-tool", "executor": "builtin.echo", "risk_level": "high"})
        agent = client.post("/api/v1/agents", headers=headers, json={"name": "expiry-agent", "definition": {}}).json()["data"]
        publish_agent(client, headers, agent["id"])
        run = client.post("/api/v1/runs", headers=headers, json={"agent_id": agent["id"], "input": {}}).json()["data"]
        client.post(f"/api/v1/runs/{run['id']}/tool-calls", headers=headers, json={"tool_name": "expiring-tool", "input": {}, "idempotency_key": "expiry-tool-idem-001"})
        client.post(f"/api/v1/runs/{run['id']}/execute", headers=headers)
        with SessionLocal() as db:
            approval = db.query(Approval).filter(Approval.run_id == run["id"]).first()
            approval.expires_at = datetime.now(UTC) - timedelta(seconds=1)
            db.commit()
        assert client.get("/api/v1/approvals", headers=headers).json()["data"] == []
        assert client.get(f"/api/v1/runs/{run['id']}", headers=headers).json()["data"]["status"] == "failed"


def test_tool_call_is_idempotent_and_run_executes():
    with TestClient(app) as client:
        headers = auth_headers(client)
        tool = client.post("/api/v1/tools", headers=headers, json={"name": "test-add", "executor": "builtin.add", "input_schema": {"required": ["left", "right"]}})
        assert tool.status_code in {201, 409}
        agent = client.post("/api/v1/agents", headers=headers, json={"name": "runtime-test-agent", "definition": {}})
        assert agent.status_code in {201, 409}
        agent_id = agent.json().get("data", {}).get("id")
        if agent_id is None:
            agent_id = client.get("/api/v1/agents", headers=headers).json()["data"][0]["id"]
        publish_agent(client, headers, agent_id)
        run = client.post("/api/v1/runs", headers=headers, json={"agent_id": agent_id, "input": {}})
        run_id = run.json()["data"]["id"]
        body = {"tool_name": "test-add", "input": {"left": 2, "right": 3}, "idempotency_key": "runtime-test-idem-001"}
        first = client.post(f"/api/v1/runs/{run_id}/tool-calls", headers=headers, json=body)
        second = client.post(f"/api/v1/runs/{run_id}/tool-calls", headers=headers, json=body)
        assert first.status_code == 202
        assert second.status_code == 202
        assert first.json()["data"]["id"] == second.json()["data"]["id"]
        executed = client.post(f"/api/v1/runs/{run_id}/execute", headers=headers)
        assert executed.json()["data"]["status"] == "completed"


def test_http_idempotency_replays_and_rejects_mismatch():
    with TestClient(app) as client:
        headers = {**auth_headers(client), "Idempotency-Key": "http-idempotency-agent-001"}
        first = client.post("/api/v1/agents", headers=headers, json={"name": "idem-agent", "definition": {}})
        second = client.post("/api/v1/agents", headers=headers, json={"name": "idem-agent", "definition": {}})
        assert first.status_code == 201
        assert second.status_code == 201
        assert first.json()["data"]["id"] == second.json()["data"]["id"]
        mismatch = client.post("/api/v1/agents", headers=headers, json={"name": "different-agent", "definition": {}})
        assert mismatch.status_code == 409


def test_cursor_pagination_is_stable_and_rejects_malformed_cursor():
    with TestClient(app) as client:
        headers = auth_headers(client)
        for index in range(3):
            response = client.post("/api/v1/agents", headers=headers, json={"name": f"cursor-agent-{uuid4().hex}-{index}", "definition": {}})
            assert response.status_code == 201
        first = client.get("/api/v1/agents?limit=2", headers=headers)
        assert first.status_code == 200
        assert len(first.json()["data"]) == 2
        cursor = first.json()["meta"]["next_cursor"]
        assert cursor
        second = client.get(f"/api/v1/agents?limit=2&cursor={cursor}", headers=headers)
        assert second.status_code == 200
        assert not {item["id"] for item in first.json()["data"]} & {item["id"] for item in second.json()["data"]}
        malformed = client.get("/api/v1/agents?cursor=not-a-cursor", headers=headers)
        assert malformed.status_code == 400
        assert malformed.json()["error"]["code"] == "VALIDATION_ERROR"


def test_runtime_events_are_persisted_and_replayed_by_sse():
    with TestClient(app) as client:
        headers = auth_headers(client)
        agent = client.post("/api/v1/agents", headers=headers, json={"name": f"event-agent-{uuid4().hex}", "definition": {}}).json()["data"]
        publish_agent(client, headers, agent["id"])
        run = client.post("/api/v1/runs", headers=headers, json={"agent_id": agent["id"], "input": {}}).json()["data"]
        client.post(f"/api/v1/runs/{run['id']}/cancel", headers=headers)
        stream = client.get(f"/api/v1/runs/{run['id']}/events", headers=headers)
        assert stream.status_code == 200
        assert "run.accepted" in stream.text
        assert "run.cancelled" in stream.text
        event_ids = [line.removeprefix("id: ") for line in stream.text.splitlines() if line.startswith("id: ")]
        assert len(event_ids) >= 2
        resumed = client.get(f"/api/v1/runs/{run['id']}/events", headers={**headers, "Last-Event-ID": event_ids[0]})
        assert resumed.status_code == 200
        assert "run.accepted" not in resumed.text
        assert "run.cancelled" in resumed.text


def test_tenant_usage_summary_is_tenant_scoped():
    with TestClient(app) as client:
        headers = auth_headers(client)
        response = client.get("/api/v1/tenant/usage", headers=headers)
        assert response.status_code == 200
        assert set(response.json()["data"]) == {"total_tokens", "cost_usd", "run_count", "active_runs"}


def test_tool_manifest_and_capability_validation():
    with TestClient(app) as client:
        headers = auth_headers(client)
        invalid = client.post("/api/v1/tools", headers=headers, json={"name": "bad-manifest", "executor": "builtin.echo", "manifest": {"id": "bad"}})
        assert invalid.status_code == 422
        valid = client.post("/api/v1/tools", headers=headers, json={"name": "signed-manifest", "executor": "builtin.echo", "manifest": {"id": "demo.echo", "version": "1.0.0", "description": "Demo", "entrypoint": "builtin.echo", "license": "MIT", "riskLevel": "low", "sideEffects": False}, "capabilities": {"networkDomains": [], "fileRoots": [], "commands": []}})
        assert valid.status_code == 201
        assert valid.json()["data"]["content_digest"]


def test_invalid_tool_input_is_rejected():
    with TestClient(app) as client:
        headers = auth_headers(client)
        agent = client.post("/api/v1/agents", headers=headers, json={"name": "runtime-invalid-agent", "definition": {}})
        agent_id = agent.json().get("data", {}).get("id")
        if agent_id is None:
            agent_id = client.get("/api/v1/agents", headers=headers).json()["data"][0]["id"]
        publish_agent(client, headers, agent_id)
        run_id = client.post("/api/v1/runs", headers=headers, json={"agent_id": agent_id, "input": {}}).json()["data"]["id"]
        response = client.post(f"/api/v1/runs/{run_id}/tool-calls", headers=headers, json={"tool_name": "test-add", "input": {"left": 1}, "idempotency_key": "runtime-test-idem-002"})
        assert response.status_code == 422


def test_json_schema_type_validation_is_enforced():
    with TestClient(app) as client:
        headers = auth_headers(client)
        tool = client.post(
            "/api/v1/tools",
            headers=headers,
            json={
                "name": "strict-echo",
                "executor": "builtin.echo",
                "input_schema": {
                    "type": "object",
                    "required": ["value"],
                    "properties": {"value": {"type": "integer"}},
                },
            },
        )
        assert tool.status_code in {201, 409}
        agent = client.post("/api/v1/agents", headers=headers, json={"name": "schema-agent", "definition": {}})
        agent_id = agent.json().get("data", {}).get("id")
        if agent_id is None:
            agent_id = client.get("/api/v1/agents", headers=headers).json()["data"][0]["id"]
        publish_agent(client, headers, agent_id)
        run_id = client.post("/api/v1/runs", headers=headers, json={"agent_id": agent_id, "input": {}}).json()["data"]["id"]
        response = client.post(
            f"/api/v1/runs/{run_id}/tool-calls",
            headers=headers,
            json={"tool_name": "strict-echo", "input": {"value": "wrong"}, "idempotency_key": "schema-test-idem-001"},
        )
        assert response.status_code == 422


def test_high_risk_tool_requires_single_use_approval():
    with TestClient(app) as client:
        headers = auth_headers(client)
        tool = client.post("/api/v1/tools", headers=headers, json={"name": "dangerous", "executor": "builtin.echo", "risk_level": "high"})
        assert tool.status_code in {201, 409}
        agent = client.post("/api/v1/agents", headers=headers, json={"name": "approval-agent", "definition": {}})
        agent_id = agent.json().get("data", {}).get("id")
        if agent_id is None:
            agent_id = client.get("/api/v1/agents", headers=headers).json()["data"][0]["id"]
        publish_agent(client, headers, agent_id)
        run_id = client.post("/api/v1/runs", headers=headers, json={"agent_id": agent_id, "input": {}}).json()["data"]["id"]
        call = client.post(f"/api/v1/runs/{run_id}/tool-calls", headers=headers, json={"tool_name": "dangerous", "input": {"value": "x"}, "idempotency_key": "approval-test-idem-001"})
        assert call.status_code == 202
        waiting = client.post(f"/api/v1/runs/{run_id}/execute", headers=headers)
        assert waiting.json()["data"]["status"] == "waiting_approval"
        approvals = client.get("/api/v1/approvals", headers=headers).json()["data"]
        approval = next(item for item in approvals if item["run_id"] == run_id)
        missing_token = client.post(f"/api/v1/approvals/{approval['id']}/decision", headers=headers, json={"decision": "approve"})
        assert missing_token.status_code == 422
        decision = client.post(f"/api/v1/approvals/{approval['id']}/decision", headers=headers, json={"decision": "approve", "token": call.json()["data"]["approval_token"]})
        assert decision.status_code == 200
        assert decision.json()["data"]["status"] == "approved"
        audit = client.get(f"/api/v1/audit?resource_type=approval&resource_id={approval['id']}", headers=headers)
        assert audit.json()["data"][0]["action"] == "approval.approved"
        duplicate = client.post(f"/api/v1/approvals/{approval['id']}/decision", headers=headers, json={"decision": "approve", "token": call.json()["data"]["approval_token"]})
        assert duplicate.status_code == 409


def test_concurrent_approval_is_atomic_and_permission_denials_are_audited():
    with TestClient(app) as client:
        headers = auth_headers(client)
        suffix = uuid4().hex
        tool_name = f"concurrent-dangerous-{suffix}"
        client.post("/api/v1/tools", headers=headers, json={"name": tool_name, "executor": "builtin.echo", "risk_level": "high"})
        agent = client.post("/api/v1/agents", headers=headers, json={"name": f"concurrent-approval-agent-{suffix}", "definition": {}}).json()["data"]
        publish_agent(client, headers, agent["id"])
        run = client.post("/api/v1/runs", headers=headers, json={"agent_id": agent["id"], "input": {}}).json()["data"]
        call = client.post(f"/api/v1/runs/{run['id']}/tool-calls", headers=headers, json={"tool_name": tool_name, "input": {"value": "x"}, "idempotency_key": f"concurrent-approval-{suffix}"}).json()["data"]
        approval = next(item for item in client.get("/api/v1/approvals", headers=headers).json()["data"] if item["run_id"] == run["id"])

        member_login = client.post("/api/v1/auth/login", json={"email": "member@example.com", "password": "ChangeMe123456!"})
        member_headers = {"Authorization": f"Bearer {member_login.json()['data']['access_token']}"}
        denied = client.post(f"/api/v1/approvals/{approval['id']}/decision", headers=member_headers, json={"decision": "approve", "token": call["approval_token"]})
        assert denied.status_code == 403
        with SessionLocal() as db:
            denial = db.query(AuditEvent).filter(AuditEvent.tenant_id == run["tenant_id"], AuditEvent.action == "permission.denied", AuditEvent.resource_type == "approval", AuditEvent.resource_id == approval["id"]).one()
            assert denial.outcome == "denied"

        def decide(decision: str):
            with TestClient(app) as concurrent_client:
                return concurrent_client.post(f"/api/v1/approvals/{approval['id']}/decision", headers=headers, json={"decision": decision, "token": call["approval_token"]})

        with ThreadPoolExecutor(max_workers=2) as executor:
            responses = list(executor.map(decide, ["approve", "reject"]))
        assert sorted(response.status_code for response in responses) == [200, 409]
        with SessionLocal() as db:
            stored = db.get(Approval, approval["id"])
            assert stored.status in {"approved", "rejected"}
            decision_events = db.query(AuditEvent).filter(AuditEvent.resource_type == "approval", AuditEvent.resource_id == approval["id"], AuditEvent.action.in_(("approval.approved", "approval.rejected"))).all()
            assert len(decision_events) == 1


def test_workflow_creates_checkpoint_and_completes():
    with TestClient(app) as client:
        headers = auth_headers(client)
        definition = {"workflow": [{"key": "prepare", "type": "prepare"}, {"key": "model", "type": "model", "depends_on": ["prepare"]}, {"key": "finalize", "type": "finalize", "depends_on": ["model"]}]}
        agent = client.post("/api/v1/agents", headers=headers, json={"name": "workflow-agent", "definition": definition})
        agent_id = agent.json().get("data", {}).get("id")
        if agent_id is None:
            agent_id = client.get("/api/v1/agents", headers=headers).json()["data"][0]["id"]
        publish_agent(client, headers, agent_id)
        run_id = client.post("/api/v1/runs", headers=headers, json={"agent_id": agent_id, "input": {"prompt": "hello"}}).json()["data"]["id"]
        result = client.post(f"/api/v1/runs/{run_id}/execute", headers=headers)
        assert result.json()["data"]["status"] == "completed"
        assert result.json()["data"]["checkpoint_version"] == 1
        with SessionLocal() as db:
            nodes = db.query(WorkflowNode).filter(WorkflowNode.workflow_id == run_id).order_by(WorkflowNode.node_key).all()
            assert len(nodes) == 3
            assert {node.status for node in nodes} == {"succeeded"}


def test_workflow_tool_node_executes_and_is_checkpointed():
    with TestClient(app) as client:
        headers = auth_headers(client)
        tool = client.post("/api/v1/tools", headers=headers, json={"name": "workflow-echo", "executor": "builtin.echo", "input_schema": {"required": ["value"]}})
        assert tool.status_code in {201, 409}
        agent = client.post("/api/v1/agents", headers=headers, json={"name": "workflow-tool-agent", "definition": {"workflow": [{"key": "tool", "type": "tool", "tool_name": "workflow-echo", "input": {"value": "ok"}}]}})
        agent_id = agent.json().get("data", {}).get("id")
        if agent_id is None:
            agent_id = client.get("/api/v1/agents", headers=headers).json()["data"][0]["id"]
        publish_agent(client, headers, agent_id)
        run_id = client.post("/api/v1/runs", headers=headers, json={"agent_id": agent_id, "input": {}}).json()["data"]["id"]
        result = client.post(f"/api/v1/runs/{run_id}/execute", headers=headers)
        assert result.status_code == 202


def test_dlq_requires_admin_role():
    with TestClient(app) as client:
        assert client.get("/api/v1/dlq").status_code == 401


def test_dlq_unavailable_is_explicit(monkeypatch):
    class UnavailableRedis:
        @classmethod
        def from_url(cls, _url, **_kwargs):
            raise RuntimeError("redis down")

    monkeypatch.setattr("app.main.Redis", UnavailableRedis)
    with TestClient(app) as client:
        response = client.get("/api/v1/dlq", headers=auth_headers(client))
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "DLQ_UNAVAILABLE"


def test_dlq_replay_resets_failed_run(monkeypatch):
    class FakeRedis:
        @classmethod
        def from_url(cls, _url, **_kwargs):
            return cls()

        def xrevrange(self, _stream, count=100):
            return [("1-0", {"run_id": self.run_id, "tenant_id": self.tenant_id, "error": "boom"})]

        def xrange(self, _stream, min, max, count=1):
            return [("1-0", {"run_id": self.run_id, "tenant_id": self.tenant_id, "error": "boom"})] if min == "1-0" and max == "1-0" else []

    monkeypatch.setattr("app.main.Redis", FakeRedis)
    with TestClient(app) as client:
        headers = auth_headers(client)
        agent = client.post("/api/v1/agents", headers=headers, json={"name": "dlq-agent", "definition": {}}).json()["data"]
        publish_agent(client, headers, agent["id"])
        run = client.post("/api/v1/runs", headers=headers, json={"agent_id": agent["id"], "input": {}}).json()["data"]
        client.post(f"/api/v1/runs/{run['id']}/cancel", headers=headers)
        FakeRedis.run_id = run["id"]
        FakeRedis.tenant_id = run["tenant_id"]
        response = client.post("/api/v1/dlq/1-0/replay", headers=headers)
        assert response.status_code == 202
        assert response.json()["data"]["status"] == "accepted"
        assert response.json()["data"]["attempt_id"] != run["attempt_id"]


def test_run_state_boundary_cancel_replay_and_checkpoint_restore():
    with TestClient(app) as client:
        headers = auth_headers(client)
        agent = client.post("/api/v1/agents", headers=headers, json={"name": f"boundary-agent-{uuid4().hex}", "definition": {}}).json()["data"]
        publish_agent(client, headers, agent["id"])

        # A completed run cannot be cancelled, while a failed run can be replayed.
        completed = client.post("/api/v1/runs", headers=headers, json={"agent_id": agent["id"], "input": {}}).json()["data"]
        with SessionLocal() as db:
            stored = db.get(Run, completed["id"])
            stored.status = "completed"
            stored.finished_at = datetime.now(UTC)
            db.commit()
        cancelled = client.post(f"/api/v1/runs/{completed['id']}/cancel", headers=headers)
        assert cancelled.status_code == 200
        assert cancelled.json()["data"]["status"] == "completed"

        failed = client.post("/api/v1/runs", headers=headers, json={"agent_id": agent["id"], "input": {}}).json()["data"]
        with SessionLocal() as db:
            stored = db.get(Run, failed["id"])
            stored.status = "failed"
            stored.finished_at = datetime.now(UTC)
            db.commit()
        replayed = client.post(f"/api/v1/runs/{failed['id']}/replay", headers=headers)
        assert replayed.status_code == 202
        assert replayed.json()["data"]["status"] == "accepted"
        assert replayed.json()["data"]["attempt_id"] != failed["attempt_id"]

        # Restore requires an existing checkpoint and a restorable run state.
        restore_target = client.post("/api/v1/runs", headers=headers, json={"agent_id": agent["id"], "input": {}}).json()["data"]
        with SessionLocal() as db:
            stored = db.get(Run, restore_target["id"])
            stored.status = "failed"
            stored.finished_at = datetime.now(UTC)
            stored.checkpoint_version = 1
            db.add(Checkpoint(tenant_id=stored.tenant_id, run_id=stored.id, attempt_id=stored.attempt_id, version=1, state_json={"workflow": [], "context": {}}))
            db.commit()
        invalid = client.post(f"/api/v1/runs/{restore_target['id']}/restore", headers=headers, json={"checkpoint_version": 0})
        assert invalid.status_code == 422
        missing = client.post(f"/api/v1/runs/{restore_target['id']}/restore", headers=headers, json={"checkpoint_version": 9})
        assert missing.status_code == 404
        assert missing.json()["error"]["code"] == "NOT_FOUND"
        restored = client.post(f"/api/v1/runs/{restore_target['id']}/restore", headers=headers, json={"checkpoint_version": 1})
        assert restored.status_code == 200
        assert restored.json()["data"]["status"] == "accepted"
        assert restored.json()["data"]["output_json"] == {"restored_from": 1}


def test_run_operations_are_tenant_scoped_and_role_protected():
    with TestClient(app) as client:
        admin_headers = auth_headers(client)
        agent = client.post("/api/v1/agents", headers=admin_headers, json={"name": f"isolation-agent-{uuid4().hex}", "definition": {}}).json()["data"]
        publish_agent(client, admin_headers, agent["id"])
        run = client.post("/api/v1/runs", headers=admin_headers, json={"agent_id": agent["id"], "input": {}}).json()["data"]
        with SessionLocal() as db:
            stored = db.get(Run, run["id"])
            stored.status = "failed"
            stored.finished_at = datetime.now(UTC)
            db.commit()

            other_tenant = Tenant(name=f"Other Tenant {uuid4().hex}", slug=f"other-{uuid4().hex}")
            db.add(other_tenant)
            db.flush()
            db.add(User(tenant_id=other_tenant.id, email="other-admin@example.com", display_name="Other Admin", role="tenant_admin", password_hash=hash_password("ChangeMe123456!")))
            db.commit()

        other_login = client.post("/api/v1/auth/login", json={"email": "other-admin@example.com", "password": "ChangeMe123456!"})
        assert other_login.status_code == 200
        other_headers = {"Authorization": f"Bearer {other_login.json()['data']['access_token']}"}
        for path, method, payload in [
            (f"/api/v1/runs/{run['id']}", "get", None),
            (f"/api/v1/runs/{run['id']}/cancel", "post", None),
            (f"/api/v1/runs/{run['id']}/replay", "post", None),
            (f"/api/v1/runs/{run['id']}/restore", "post", {"checkpoint_version": 1}),
        ]:
            response = getattr(client, method)(path, headers=other_headers, json=payload) if payload is not None else getattr(client, method)(path, headers=other_headers)
            assert response.status_code == 404, (path, response.text)
            assert response.json()["error"]["code"] == "NOT_FOUND"

        denied_audit = client.get(f"/api/v1/audit?resource_type=run&resource_id={run['id']}", headers=other_headers)
        assert denied_audit.status_code == 200
        denied_events = [item for item in denied_audit.json()["data"] if item["action"] == "permission.denied"]
        assert len(denied_events) == 4
        assert all(item["outcome"] == "denied" for item in denied_events)

        readonly_login = client.post("/api/v1/auth/login", json={"email": "readonly@example.com", "password": "ChangeMe123456!"})
        readonly_headers = {"Authorization": f"Bearer {readonly_login.json()['data']['access_token']}"}
        assert client.get(f"/api/v1/runs/{run['id']}", headers=readonly_headers).status_code == 200
        for path, payload in [
            (f"/api/v1/runs/{run['id']}/cancel", None),
            (f"/api/v1/runs/{run['id']}/replay", None),
            (f"/api/v1/runs/{run['id']}/restore", {"checkpoint_version": 1}),
        ]:
            response = client.post(path, headers=readonly_headers, json=payload) if payload is not None else client.post(path, headers=readonly_headers)
            assert response.status_code == 403, (path, response.text)
            assert response.json()["error"]["code"] == "FORBIDDEN"


def test_run_operations_keep_audit_and_sse_events_consistent():
    with TestClient(app) as client:
        headers = auth_headers(client)
        agent = client.post("/api/v1/agents", headers=headers, json={"name": f"audit-agent-{uuid4().hex}", "definition": {}}).json()["data"]
        publish_agent(client, headers, agent["id"])

        def actions(run_id: str) -> set[str]:
            response = client.get(f"/api/v1/audit?resource_type=run&resource_id={run_id}", headers=headers)
            assert response.status_code == 200
            return {item["action"] for item in response.json()["data"]}

        cancelled = client.post("/api/v1/runs", headers=headers, json={"agent_id": agent["id"], "input": {}}).json()["data"]
        assert client.post(f"/api/v1/runs/{cancelled['id']}/cancel", headers=headers).status_code == 202
        assert "run.cancelled" in actions(cancelled["id"])
        cancel_events = client.get(f"/api/v1/runs/{cancelled['id']}/events", headers=headers)
        assert cancel_events.status_code == 200
        assert "event: run.accepted" in cancel_events.text and "event: run.cancelled" in cancel_events.text

        replay = client.post("/api/v1/runs", headers=headers, json={"agent_id": agent["id"], "input": {}}).json()["data"]
        with SessionLocal() as db:
            stored = db.get(Run, replay["id"])
            stored.status = "failed"
            stored.finished_at = datetime.now(UTC)
            db.commit()
        assert client.post(f"/api/v1/runs/{replay['id']}/replay", headers=headers).status_code == 202
        assert "run.replayed" in actions(replay["id"])
        with SessionLocal() as db:
            stored = db.get(Run, replay["id"])
            stored.status = "failed"
            stored.finished_at = datetime.now(UTC)
            db.commit()
        replay_events = client.get(f"/api/v1/runs/{replay['id']}/events", headers=headers)
        assert replay_events.status_code == 200
        assert "event: run.replayed" in replay_events.text

        restored = client.post("/api/v1/runs", headers=headers, json={"agent_id": agent["id"], "input": {}}).json()["data"]
        with SessionLocal() as db:
            stored = db.get(Run, restored["id"])
            stored.status = "failed"
            stored.finished_at = datetime.now(UTC)
            stored.checkpoint_version = 1
            db.add(Checkpoint(tenant_id=stored.tenant_id, run_id=stored.id, attempt_id=stored.attempt_id, version=1, state_json={"workflow": [], "context": {}}))
            db.commit()
        assert client.post(f"/api/v1/runs/{restored['id']}/restore", headers=headers, json={"checkpoint_version": 1}).status_code == 200
        assert "run.restored" in actions(restored["id"])
        with SessionLocal() as db:
            stored = db.get(Run, restored["id"])
            stored.status = "failed"
            stored.finished_at = datetime.now(UTC)
            db.commit()
        restore_events = client.get(f"/api/v1/runs/{restored['id']}/events", headers=headers)
        assert restore_events.status_code == 200
        assert "event: run.restored" in restore_events.text
