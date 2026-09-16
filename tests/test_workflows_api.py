from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


def test_workflow_operations_are_registered_in_openapi():
    paths = app.openapi()["paths"]
    expected = {
        "/api/v1/workflows": {"get", "post"},
        "/api/v1/workflows/{workflow_id}": {"get", "put", "delete"},
        "/api/v1/workflows/{workflow_id}/duplicate": {"post"},
    }
    for path, methods in expected.items():
        assert path in paths
        assert methods <= set(paths[path])
        for method in methods:
            operation = paths[path][method]
            assert operation["tags"] == ["workflows"]
            assert operation["summary"]


def auth_headers(client: TestClient) -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "ChangeMe123456!"})
    if response.status_code == 401:
        from scripts.seed import main

        main()
        response = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "ChangeMe123456!"})
    return {"Authorization": f"Bearer {response.json()['data']['access_token']}"}


def workflow_payload(name: str | None = None) -> dict:
    return {"name": name or f"workflow-{uuid4().hex}", "description": "合同测试", "nodes": [{"id": "start", "data": {"label": "开始", "kind": "prepare"}}]}


def test_workflow_crud_versioning_duplicate_and_soft_delete():
    with TestClient(app) as client:
        headers = auth_headers(client)
        created = client.post("/api/v1/workflows", headers=headers, json=workflow_payload())
        assert created.status_code == 201
        item = created.json()["data"]
        assert item["version"] == 1 and item["nodes"][0]["key"] == "start"
        assert client.put(f"/api/v1/workflows/{item['id']}", headers=headers, json={"description": "missing"}).status_code == 428
        updated = client.put(f"/api/v1/workflows/{item['id']}", headers={**headers, "If-Match": "1"}, json={"description": "updated"})
        assert updated.status_code == 200 and updated.json()["data"]["version"] == 2
        assert client.put(f"/api/v1/workflows/{item['id']}", headers={**headers, "If-Match": "1"}, json={"description": "stale"}).status_code == 412
        duplicate = client.post(f"/api/v1/workflows/{item['id']}/duplicate", headers=headers)
        assert duplicate.status_code == 201 and duplicate.json()["data"]["id"] != item["id"]
        assert client.delete(f"/api/v1/workflows/{item['id']}", headers=headers).status_code == 204
        assert client.get(f"/api/v1/workflows/{item['id']}", headers=headers).status_code == 404


def test_workflow_list_supports_search_and_cursor_meta():
    with TestClient(app) as client:
        headers = auth_headers(client)
        client.post("/api/v1/workflows", headers=headers, json=workflow_payload("unique-workflow-filter"))
        response = client.get("/api/v1/workflows?search=unique-workflow-filter&limit=1", headers=headers)
        assert response.status_code == 200
        assert len(response.json()["data"]) == 1
        assert "next_cursor" in response.json()["meta"]


def test_workflow_node_config_validation_rejects_invalid_runtime_fields():
    with TestClient(app) as client:
        headers = auth_headers(client)
        cases = [
            ({"id": "model-1", "type": "model", "config": {}}, "prompt"),
            ({"id": "tool-1", "type": "tool", "config": {"tool_id": "tool-1", "input": []}}, "input"),
            ({"id": "condition-1", "type": "condition", "config": {"condition_type": "comparison", "left": "status", "operator": "equals", "right": "ready", "true_next": "ok"}}, "false_next"),
        ]
        for index, (node, field) in enumerate(cases):
            response = client.post(
                "/api/v1/workflows",
                headers=headers,
                json={"name": f"invalid-config-{uuid4().hex}-{index}", "nodes": [node]},
            )
            assert response.status_code == 422
            detail = response.json()["error"]
            assert detail["code"] == "WORKFLOW_NODE_INVALID"
            assert detail["details"]["node_id"] == node["id"]
            assert detail["details"]["field"] == field


def test_workflow_update_preserves_edges_when_only_nodes_are_sent():
    with TestClient(app) as client:
        headers = auth_headers(client)
        created = client.post(
            "/api/v1/workflows",
            headers=headers,
            json={
                "name": f"preserve-edges-{uuid4().hex}",
                "nodes": [
                    {"id": "start", "type": "start", "label": "开始"},
                    {"id": "prepare", "type": "prepare", "label": "准备"},
                    {"id": "end", "type": "end", "label": "结束"},
                ],
                "edges": [
                    {"source": "start", "target": "prepare"},
                    {"source": "prepare", "target": "end"},
                ],
            },
        )
        item = created.json()["data"]
        updated_nodes = item["nodes"]
        updated_nodes[1]["label"] = "准备新数据"
        updated = client.put(
            f"/api/v1/workflows/{item['id']}",
            headers={**headers, "If-Match": str(item["version"])},
            json={"nodes": updated_nodes},
        )
        assert updated.status_code == 200
        assert {(edge["source"], edge["target"]) for edge in updated.json()["data"]["edges"]} == {
            ("start", "prepare"),
            ("prepare", "end"),
        }


def test_workflow_rejects_edges_with_missing_nodes():
    with TestClient(app) as client:
        headers = auth_headers(client)
        response = client.post(
            "/api/v1/workflows",
            headers=headers,
            json={
                "name": f"invalid-edge-{uuid4().hex}",
                "nodes": [{"id": "start", "type": "start", "label": "开始"}],
                "edges": [{"source": "start", "target": "missing"}],
            },
        )
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "WORKFLOW_EDGE_INVALID"


def test_workflow_detail_exposes_condition_branch_edges():
    with TestClient(app) as client:
        headers = auth_headers(client)
        response = client.post(
            "/api/v1/workflows",
            headers=headers,
            json={
                "name": f"condition-edges-{uuid4().hex}",
                "nodes": [
                    {"id": "start", "type": "start", "label": "开始"},
                    {
                        "id": "branch",
                        "type": "condition",
                        "label": "条件",
                        "config": {
                            "condition_type": "comparison",
                            "left": "status",
                            "operator": "equals",
                            "right": "ready",
                            "true_next": "success",
                            "false_next": "failure",
                        },
                    },
                    {"id": "success", "type": "prepare", "label": "成功"},
                    {"id": "failure", "type": "prepare", "label": "失败"},
                ],
                "edges": [{"source": "start", "target": "branch"}],
            },
        )
        assert response.status_code == 201
        branch_edges = [edge for edge in response.json()["data"]["edges"] if edge["source"] == "branch"]
        assert {(edge["sourceHandle"], edge["target"]) for edge in branch_edges} == {
            ("true", "success"),
            ("false", "failure"),
        }


def test_visual_editor_tool_node_is_persisted_and_executed():
    with TestClient(app) as client:
        headers = auth_headers(client)
        stamp = uuid4().hex[:8]
        tool_name = f"visual-echo-{stamp}"
        tool_response = client.post(
            "/api/v1/tools",
            headers=headers,
            json={"name": tool_name, "executor": "builtin.echo"},
        )
        assert tool_response.status_code == 201
        tool = tool_response.json()["data"]

        created = client.post(
            "/api/v1/workflows",
            headers=headers,
            json={
                "name": f"visual-tool-workflow-{stamp}",
                "nodes": [
                    {"id": "start-1", "type": "start", "label": "开始"},
                    {
                        "id": "tool-1",
                        "type": "tool",
                        "label": f"工具（1）：{tool_name}",
                        "config": {"tool_id": tool["id"], "tool_name": tool_name},
                    },
                    {"id": "end-1", "type": "end", "label": "结束"},
                ],
                "edges": [
                    {"source": "start-1", "target": "tool-1"},
                    {"source": "tool-1", "target": "end-1"},
                ],
            },
        )
        assert created.status_code == 201
        workflow = created.json()["data"]
        tool_node = next(node for node in workflow["nodes"] if node["type"] == "tool")
        assert tool_node["tool_id"] == tool["id"]
        assert tool_node["config"]["tool_name"] == tool_name

        assert client.post(f"/api/v1/agents/{workflow['id']}/publish", headers=headers).status_code == 201
        instance_response = client.post(
            "/api/v1/workflow-instances",
            headers=headers,
            json={"workflow_id": workflow["id"], "input": {"prompt": "真实工具调用"}},
        )
        assert instance_response.status_code == 202
        instance = instance_response.json()["data"]

        from app.worker import process_once

        assert process_once(run_id=instance["run_id"]) == 1
        completed = client.get(f"/api/v1/workflow-instances/{instance['id']}", headers=headers)
        assert completed.status_code == 200
        assert completed.json()["data"]["status"] == "completed"

        calls = client.get(f"/api/v1/tools/{tool['id']}/calls", headers=headers)
        assert calls.status_code == 200
        assert any(call["run_id"] == instance["run_id"] and call["status"] == "succeeded" for call in calls.json()["data"])
