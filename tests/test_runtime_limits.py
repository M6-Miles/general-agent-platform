from app.db import SessionLocal
from app.models import ToolDefinition
from app.worker import MAX_TOOL_CALLS, MAX_WORKFLOW_NODES, execute_workflow
from tests.test_worker import create_run


def test_workflow_node_limit_is_enforced():
    workflow = [{"key": f"node-{i}", "type": "prepare"} for i in range(MAX_WORKFLOW_NODES + 1)]
    with SessionLocal() as db:
        _, _, agent, run = create_run(db, workflow=workflow)
        assert execute_workflow(db, run, agent) == "failed"
        assert run.output_json["error"] == "WORKFLOW_NODE_LIMIT_EXCEEDED"


def test_tool_call_limit_stops_before_excessive_calls():
    workflow = [{"key": f"tool-{i}", "type": "tool", "tool_name": "limited-echo", "input": {"value": i}} for i in range(MAX_TOOL_CALLS + 1)]
    with SessionLocal() as db:
        tenant, user, agent, run = create_run(db, workflow=workflow)
        db.add(ToolDefinition(tenant_id=tenant.id, name="limited-echo", executor="builtin.echo", created_by=user.id))
        db.flush()
        assert execute_workflow(db, run, agent) == "budget_exceeded"
        assert run.output_json["error"] == "TOOL_CALL_LIMIT_EXCEEDED"
