from app.db import SessionLocal
from app.worker import execute_workflow
from tests.test_worker import create_run


def test_linear_workflow_and_conditional_skip_persist_node_states():
    workflow = [
        {"key": "prepare", "type": "prepare"},
        {"key": "model", "type": "model", "depends_on": ["prepare"]},
        {"key": "skipped", "type": "finalize", "depends_on": ["model"], "when": {"field": "missing", "equals": True}},
        {"key": "finalize", "type": "finalize", "depends_on": ["model"]},
    ]
    with SessionLocal() as db:
        _, _, agent, run = create_run(db, workflow=workflow)
        assert execute_workflow(db, run, agent) == "ok"
        db.commit()
        statuses = {node["key"]: node["status"] for node in run.output_json["workflow"]}
        assert statuses == {"prepare": "succeeded", "model": "succeeded", "skipped": "skipped", "finalize": "succeeded"}


def test_workflow_cycle_is_rejected_before_execution():
    workflow = [{"key": "a", "type": "prepare", "depends_on": ["b"]}, {"key": "b", "type": "finalize", "depends_on": ["a"]}]
    with SessionLocal() as db:
        _, _, agent, run = create_run(db, workflow=workflow)
        assert execute_workflow(db, run, agent) == "failed"
        assert run.output_json == {"error": "INVALID_WORKFLOW_CYCLE"}


def _run_branch(value):
    workflow = [
        {"key": "condition", "type": "condition", "condition_type": "comparison", "left": "value", "operator": "equals", "right": value, "true_next": "success", "false_next": "failure"},
        {"key": "success", "type": "finalize"},
        {"key": "failure", "type": "prepare"},
    ]
    with SessionLocal() as db:
        _, _, agent, run = create_run(db, workflow=workflow)
        run.input_json = {"value": value}
        assert execute_workflow(db, run, agent) == "ok"
        return {node["key"]: node["status"] for node in run.output_json["workflow"]}


def test_condition_true_next_selects_true_branch():
    statuses = _run_branch("yes")
    assert statuses == {"condition": "succeeded", "success": "succeeded", "failure": "skipped"}


def test_condition_false_next_selects_false_branch():
    workflow = [
        {"key": "condition", "type": "condition", "condition_type": "comparison", "left": "value", "operator": "equals", "right": "yes", "true_next": "success", "false_next": "failure"},
        {"key": "success", "type": "finalize"},
        {"key": "failure", "type": "prepare"},
    ]
    with SessionLocal() as db:
        _, _, agent, run = create_run(db, workflow=workflow)
        run.input_json = {"value": "no"}
        assert execute_workflow(db, run, agent) == "ok"
        statuses = {node["key"]: node["status"] for node in run.output_json["workflow"]}
        assert statuses == {"condition": "succeeded", "success": "skipped", "failure": "succeeded"}
