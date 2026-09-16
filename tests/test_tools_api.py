from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


def auth_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "ChangeMe123456!"},
    )
    if response.status_code == 401:
        from scripts.seed import main

        main()
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "ChangeMe123456!"},
        )
    return {"Authorization": f"Bearer {response.json()['data']['access_token']}"}


def test_tool_detail_update_history_and_soft_delete():
    with TestClient(app) as client:
        headers = auth_headers(client)
        tool_name = f"detail-tool-{uuid4().hex[:8]}"
        created = client.post(
            "/api/v1/tools",
            headers=headers,
            json={"name": tool_name, "executor": "builtin.echo"},
        )
        assert created.status_code == 201
        tool = created.json()["data"]

        versions = client.get(f"/api/v1/tools/{tool['id']}/versions", headers=headers)
        assert versions.status_code == 200
        assert [(item["version"], item["description"]) for item in versions.json()["data"]] == [(1, "")]

        detail = client.get(f"/api/v1/tools/{tool['id']}", headers=headers)
        assert detail.status_code == 200
        assert detail.json()["data"]["name"] == tool_name

        missing_precondition = client.patch(
            f"/api/v1/tools/{tool['id']}",
            headers=headers,
            json={"description": "updated"},
        )
        assert missing_precondition.status_code == 428

        updated = client.patch(
            f"/api/v1/tools/{tool['id']}",
            headers={**headers, "If-Match": "1"},
            json={"description": "可编辑工具", "timeout_ms": 8000},
        )
        assert updated.status_code == 200
        assert updated.json()["data"]["description"] == "可编辑工具"
        assert updated.json()["data"]["version"] == 2

        versions = client.get(f"/api/v1/tools/{tool['id']}/versions", headers=headers)
        assert [(item["version"], item["description"]) for item in versions.json()["data"]] == [
            (2, "可编辑工具"),
            (1, ""),
        ]

        stale = client.patch(
            f"/api/v1/tools/{tool['id']}",
            headers={**headers, "If-Match": "1"},
            json={"description": "stale"},
        )
        assert stale.status_code == 412

        rolled_back = client.post(
            f"/api/v1/tools/{tool['id']}/rollback",
            headers={**headers, "If-Match": "2"},
            json={"version": 1},
        )
        assert rolled_back.status_code == 201
        assert rolled_back.json()["data"]["version"] == 3
        assert rolled_back.json()["data"]["description"] == ""
        assert rolled_back.json()["data"]["timeout_ms"] == 5000
        versions = client.get(f"/api/v1/tools/{tool['id']}/versions", headers=headers)
        assert [(item["version"], item["description"]) for item in versions.json()["data"]] == [
            (3, ""),
            (2, "可编辑工具"),
            (1, ""),
        ]

        agent = client.post(
            "/api/v1/agents",
            headers=headers,
            json={"name": f"tool-history-agent-{uuid4().hex[:8]}", "definition": {}},
        ).json()["data"]
        assert client.post(f"/api/v1/agents/{agent['id']}/publish", headers=headers).status_code == 201
        run = client.post(
            "/api/v1/runs",
            headers=headers,
            json={"agent_id": agent["id"], "input": {}},
        ).json()["data"]
        call = client.post(
            f"/api/v1/runs/{run['id']}/tool-calls",
            headers=headers,
            json={
                "tool_name": tool_name,
                "input": {"value": "history"},
                "idempotency_key": f"tool-history-{uuid4().hex}",
            },
        )
        assert call.status_code == 202
        history = client.get(f"/api/v1/tools/{tool['id']}/calls", headers=headers)
        assert history.status_code == 200
        assert [item["id"] for item in history.json()["data"]] == [call.json()["data"]["id"]]

        deleted = client.delete(f"/api/v1/tools/{tool['id']}", headers=headers)
        assert deleted.status_code == 204
        assert client.get(f"/api/v1/tools/{tool['id']}", headers=headers).status_code == 404
        audits = client.get(
            f"/api/v1/audit?resource_type=tool&resource_id={tool['id']}",
            headers=headers,
        ).json()["data"]
        assert {event["action"] for event in audits} >= {
            "tool.updated",
            "tool.rolled_back",
            "tool.deleted",
        }
