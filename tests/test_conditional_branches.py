"""Regression tests for conditional branch workflow execution.

This test suite ensures that when a condition node routes to one branch,
all descendants of the non-selected branch are properly skipped, including
nested tool calls and model invocations.
"""

from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.main import app
from app.models import WorkflowNode


def auth_headers(client: TestClient) -> dict[str, str]:
    """Get authentication headers for test requests."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "ChangeMe123456!"}
    )
    if response.status_code == 401:
        from scripts.seed import main
        main()
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "ChangeMe123456!"}
        )
    return {"Authorization": f"Bearer {response.json()['data']['access_token']}"}


def test_condition_skips_tool_calls_in_unselected_branch():
    """Test that tool calls in the false branch are skipped when condition is true."""
    with TestClient(app) as client:
        headers = auth_headers(client)

        # Create an agent with a conditional workflow that has tool calls in both branches
        workflow = [
            {
                "key": "condition1",
                "type": "condition",
                "condition_type": "comparison",
                "left": "value",
                "operator": "equals",
                "right": 10,
                "true_next": "tool_true",
                "false_next": "tool_false"
            },
            {
                "key": "tool_true",
                "type": "tool",
                "tool_name": "http_request",
                "input": {"url": "https://example.com/true"},
                "depends_on": ["condition1"]
            },
            {
                "key": "tool_false",
                "type": "tool",
                "tool_name": "http_request",
                "input": {"url": "https://example.com/false"},
                "depends_on": ["condition1"]
            }
        ]

        agent_response = client.post(
            "/api/v1/agents",
            headers=headers,
            json={
                "name": "conditional-tool-test",
                "definition": {"workflow": workflow}
            }
        )
        assert agent_response.status_code == 201
        agent_id = agent_response.json()["data"]["id"]

        # Publish the agent
        publish_response = client.post(
            f"/api/v1/agents/{agent_id}/publish",
            headers=headers
        )
        assert publish_response.status_code == 201

        # Run the agent with value=10 (condition should be true)
        run_response = client.post(
            "/api/v1/runs",
            headers=headers,
            json={
                "agent_id": agent_id,
                "input": {"value": 10}
            }
        )
        assert run_response.status_code == 202
        run_id = run_response.json()["data"]["id"]

        # Wait for completion and check results
        from app.worker import process_once
        assert process_once(run_id=run_id) > 0

        # Use a fresh session: the request session may hold a pre-processing SQLite snapshot.
        with SessionLocal() as db:
            nodes = db.query(WorkflowNode).filter(
                WorkflowNode.workflow_id == run_id,
                WorkflowNode.node_key == "tool_false"
            ).all()
            assert len(nodes) > 0, "tool_false node should exist"
            assert nodes[0].status == "skipped", "tool_false should be skipped when condition is true"


def test_nested_condition_descendants_are_skipped():
    """Test that nested descendants of unselected branches are all skipped."""
    with TestClient(app) as client:
        headers = auth_headers(client)

        # Create a workflow with nested conditions and dependencies
        workflow = [
            {
                "key": "condition1",
                "type": "condition",
                "condition_type": "comparison",
                "left": "value",
                "operator": "equals",
                "right": 10,
                "true_next": "model_a",
                "false_next": "model_b"
            },
            {
                "key": "model_a",
                "type": "model",
                "prompt": "Process branch A",
                "depends_on": ["condition1"]
            },
            {
                "key": "model_b",
                "type": "model",
                "prompt": "Process branch B",
                "depends_on": ["condition1"]
            },
            {
                "key": "nested_condition",
                "type": "condition",
                "condition_type": "comparison",
                "left": "nested",
                "operator": "equals",
                "right": True,
                "true_next": "tool_b1",
                "false_next": "tool_b2",
                "depends_on": ["model_b"]
            },
            {
                "key": "tool_b1",
                "type": "tool",
                "tool_name": "http_request",
                "input": {"url": "https://example.com/b1"},
                "depends_on": ["nested_condition"]
            },
            {
                "key": "tool_b2",
                "type": "tool",
                "tool_name": "http_request",
                "input": {"url": "https://example.com/b2"},
                "depends_on": ["nested_condition"]
            }
        ]

        agent_response = client.post(
            "/api/v1/agents",
            headers=headers,
            json={
                "name": "nested-conditional-test",
                "definition": {"workflow": workflow}
            }
        )
        assert agent_response.status_code == 201
        agent_id = agent_response.json()["data"]["id"]

        # Publish the agent
        client.post(f"/api/v1/agents/{agent_id}/publish", headers=headers)

        # Run with value=10 (takes branch A, so entire B branch tree should be skipped)
        run_response = client.post(
            "/api/v1/runs",
            headers=headers,
            json={
                "agent_id": agent_id,
                "input": {"value": 10}
            }
        )
        run_id = run_response.json()["data"]["id"]

        # Process the run
        from app.worker import process_once
        assert process_once(run_id=run_id) > 0

        with SessionLocal() as db:
            # Check that all B branch descendants are skipped
            skipped_keys = ["model_b", "nested_condition", "tool_b1", "tool_b2"]
            for key in skipped_keys:
                nodes = db.query(WorkflowNode).filter(
                    WorkflowNode.workflow_id == run_id,
                    WorkflowNode.node_key == key
                ).all()
                assert len(nodes) > 0, f"Node {key} should exist"
                assert nodes[0].status == "skipped", \
                    f"Node {key} should be skipped as it's a descendant of unselected branch"


def test_multiple_conditions_with_dependencies():
    """Test multiple conditions with complex dependency graphs."""
    with TestClient(app) as client:
        headers = auth_headers(client)

        # Workflow with multiple independent conditions
        workflow = [
            {
                "key": "condition1",
                "type": "condition",
                "condition_type": "comparison",
                "left": "branch",
                "operator": "equals",
                "right": "A",
                "true_next": "action_a",
                "false_next": "action_b"
            },
            {
                "key": "action_a",
                "type": "model",
                "prompt": "Action A",
                "depends_on": ["condition1"]
            },
            {
                "key": "action_b",
                "type": "model",
                "prompt": "Action B",
                "depends_on": ["condition1"]
            },
            {
                "key": "merge_point",
                "type": "model",
                "prompt": "Merge results",
                "depends_on": ["action_a", "action_b"]
            }
        ]

        agent_response = client.post(
            "/api/v1/agents",
            headers=headers,
            json={
                "name": "multi-condition-test",
                "definition": {"workflow": workflow}
            }
        )
        agent_id = agent_response.json()["data"]["id"]
        client.post(f"/api/v1/agents/{agent_id}/publish", headers=headers)

        # Run with branch=A
        run_response = client.post(
            "/api/v1/runs",
            headers=headers,
            json={"agent_id": agent_id, "input": {"branch": "A"}}
        )
        run_id = run_response.json()["data"]["id"]

        from app.worker import process_once
        assert process_once(run_id=run_id) > 0

        with SessionLocal() as db:
            # action_a should succeed
            action_a = db.query(WorkflowNode).filter(
                WorkflowNode.workflow_id == run_id,
                WorkflowNode.node_key == "action_a"
            ).first()
            assert action_a is not None and action_a.status == "succeeded"

            # action_b should be skipped
            action_b = db.query(WorkflowNode).filter(
                WorkflowNode.workflow_id == run_id,
                WorkflowNode.node_key == "action_b"
            ).first()
            assert action_b is not None and action_b.status == "skipped"

            # merge_point depends on both, so it will still run
            # (current implementation handles multi-dependency nodes)
