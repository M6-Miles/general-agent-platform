import hashlib
from uuid import uuid4

from app.db import SessionLocal
from app.models import (
    Agent,
    Approval,
    AuditEvent,
    Checkpoint,
    Run,
    Tenant,
    ToolCall,
    ToolDefinition,
    User,
    WorkflowNode,
)
from app.worker import (
    complete_model,
    execute_workflow,
    process_once,
    process_stream_once,
    publish_run,
)


def create_run(db, *, workflow=None, status="accepted", budget=None, usage=None):
    suffix = uuid4().hex
    tenant = Tenant(name=f"Worker Tenant {suffix}", slug=f"worker-{suffix}")
    db.add(tenant)
    db.flush()
    user = User(
        tenant_id=tenant.id,
        email=f"worker-{suffix}@example.com",
        display_name="Worker User",
        role="tenant_admin",
        password_hash="not-used",
    )
    db.add(user)
    db.flush()
    agent = Agent(
        tenant_id=tenant.id,
        name=f"worker-agent-{suffix}",
        definition={"workflow": workflow or []},
        created_by=user.id,
        updated_by=user.id,
    )
    db.add(agent)
    db.flush()
    run = Run(
        tenant_id=tenant.id,
        agent_id=agent.id,
        status=status,
        input_json={"prompt": "hello"},
        created_by=user.id,
        budget_json=budget or {},
        usage_json=usage or {},
    )
    db.add(run)
    db.flush()
    return tenant, user, agent, run


def finish_other_active_runs(db, keep_id: str) -> None:
    active = ("accepted", "preparing", "running", "waiting_approval")
    db.query(Run).filter(Run.id != keep_id, Run.status.in_(active)).update(
        {Run.status: "failed"}, synchronize_session=False
    )


def test_worker_polls_and_executes_pending_run():
    with SessionLocal() as db:
        _, _, _, run = create_run(db)
        run_id = run.id
        finish_other_active_runs(db, run_id)
        db.commit()

    assert process_once(run_id=run_id) == 1
    with SessionLocal() as db:
        stored = db.get(Run, run_id)
        assert stored.status == "completed"
        assert db.query(AuditEvent).filter_by(resource_id=run_id, action="run.completed").one()


def test_worker_processes_multiple_accepted_runs_by_requested_id():
    with SessionLocal() as db:
        _, _, _, first = create_run(db)
        _, _, _, second = create_run(db)
        first_id, second_id = first.id, second.id
        db.commit()

    assert process_once(run_id=second_id) == 1
    with SessionLocal() as db:
        assert db.get(Run, second_id).status == "completed"
        assert db.get(Run, first_id).status == "accepted"

    assert process_once(run_id=first_id) == 1
    with SessionLocal() as db:
        assert db.get(Run, first_id).status == "completed"


def test_worker_executes_workflow_dag_in_topological_order():
    workflow = [
        {"key": "finalize", "type": "finalize", "depends_on": ["model"]},
        {"key": "model", "type": "model", "depends_on": ["prepare"]},
        {"key": "prepare", "type": "prepare"},
    ]
    with SessionLocal() as db:
        _, _, agent, run = create_run(db, workflow=workflow)
        assert execute_workflow(db, run, agent) == "ok"
        db.commit()
        checkpoint = db.query(Checkpoint).filter_by(run_id=run.id).one()
        assert [node["key"] for node in checkpoint.state_json["workflow"]] == [
            "prepare",
            "model",
            "finalize",
        ]
        nodes = db.query(WorkflowNode).filter_by(workflow_id=run.id).all()
        assert len(nodes) == 3
        assert {node.status for node in nodes} == {"succeeded"}


def test_worker_handles_tool_execution_failure():
    workflow = [{"key": "missing", "type": "tool", "tool_name": "not-registered"}]
    with SessionLocal() as db:
        _, _, agent, run = create_run(db, workflow=workflow)
        assert execute_workflow(db, run, agent) == "failed"
        assert run.output_json == {"error": "TOOL_NOT_FOUND"}


def test_worker_creates_checkpoint_for_successful_tool():
    workflow = [
        {"key": "echo", "type": "tool", "tool_name": "worker-echo", "input": {"value": "ok"}}
    ]
    with SessionLocal() as db:
        tenant, user, agent, run = create_run(db, workflow=workflow)
        db.add(
            ToolDefinition(
                tenant_id=tenant.id,
                name="worker-echo",
                executor="builtin.echo",
                created_by=user.id,
            )
        )
        db.flush()
        assert execute_workflow(db, run, agent) == "ok"
        db.commit()
        assert db.query(Checkpoint).filter_by(run_id=run.id).count() == 1
        call = db.query(ToolCall).filter_by(run_id=run.id).one()
        assert call.status == "succeeded"
        assert call.output_json == {"value": "ok"}


def test_worker_respects_budget_limits():
    workflow = [{"key": "prepare", "type": "prepare"}]
    with SessionLocal() as db:
        _, _, agent, run = create_run(
            db,
            workflow=workflow,
            budget={"max_tokens": 1},
            usage={"total_tokens": 1},
        )
        assert execute_workflow(db, run, agent) == "budget_exceeded"
        assert run.output_json["error"] == "BUDGET_EXCEEDED"


def test_worker_handles_approval_required_tools():
    workflow = [{"key": "danger", "type": "tool", "tool_name": "worker-danger"}]
    with SessionLocal() as db:
        tenant, user, agent, run = create_run(db, workflow=workflow)
        db.add(
            ToolDefinition(
                tenant_id=tenant.id,
                name="worker-danger",
                executor="builtin.echo",
                risk_level="high",
                created_by=user.id,
            )
        )
        db.flush()
        assert execute_workflow(db, run, agent) == "waiting"
        db.commit()
        assert db.query(Approval).filter_by(run_id=run.id, status="pending").one()
        approval = db.query(Approval).filter_by(run_id=run.id, status="pending").one()
        from app.models import RuntimeEvent
        event = db.query(RuntimeEvent).filter_by(run_id=run.id, event_type="tool.approval.required").one()
        token = event.payload_json["approval_token"]
        assert len(token) >= 32
        assert approval.token_hash == hashlib.sha256(token.encode()).hexdigest()
        node = db.query(WorkflowNode).filter_by(workflow_id=run.id, node_key="danger").one()
        assert node.status == "waiting_approval"


def test_worker_recovers_latest_checkpoint_before_completing():
    with SessionLocal() as db:
        tenant, _, _, run = create_run(db, status="running")
        run_id = run.id
        db.add(
            Checkpoint(
                tenant_id=tenant.id,
                run_id=run.id,
                attempt_id=run.attempt_id,
                version=2,
                state_json={"context": {"recovered": True}},
            )
        )
        finish_other_active_runs(db, run_id)
        db.commit()

    assert process_once() == 1
    with SessionLocal() as db:
        stored = db.get(Run, run_id)
        assert stored.status == "completed"
        assert stored.checkpoint_version == 2
        assert stored.output_json == {"recovered_from": 2}


def test_complete_model_retries_transient_failure(monkeypatch):
    attempts = 0

    class Provider:
        def complete(self, _prompt, _context):
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                raise ValueError("MODEL_PROVIDER_TRANSIENT")
            return {"text": "ok", "usage": {"prompt_tokens": 2, "completion_tokens": 3}}

    monkeypatch.setattr("app.worker.get_model_provider", lambda _settings: Provider())
    monkeypatch.setattr("app.worker.time.sleep", lambda _seconds: None)
    result, metrics = complete_model("hello", {})
    assert result["text"] == "ok"
    assert attempts == 2
    assert metrics["attempts"] == 2
    assert metrics["total_tokens"] == 5


def test_redis_stream_failure_falls_back_cleanly(monkeypatch):
    class BrokenRedis:
        @classmethod
        def from_url(cls, *_args, **_kwargs):
            return cls()

        def xgroup_create(self, *_args, **_kwargs):
            raise ConnectionError("offline")

    monkeypatch.setattr("app.worker.Redis", BrokenRedis)
    assert process_stream_once() == 0


def test_publish_run_is_noop_without_redis(monkeypatch):
    monkeypatch.setattr("app.worker.Redis", None)
    assert publish_run("run-id") is None
