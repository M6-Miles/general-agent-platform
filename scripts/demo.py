#!/usr/bin/env python3
"""Run the OpenClaw MVP happy path against a running API and Worker."""

import argparse
import json
import time
from datetime import UTC, datetime
from typing import Any
from urllib import error, request


class DemoClient:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.token: str | None = None

    def call(self, method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        body = json.dumps(payload).encode() if payload is not None else None
        api_request = request.Request(
            f"{self.base_url}{path}", data=body, headers=headers, method=method
        )
        try:
            with request.urlopen(api_request, timeout=15) as response:
                return json.loads(response.read())
        except error.HTTPError as exc:
            detail = exc.read().decode(errors="replace")
            raise RuntimeError(f"{method} {path} failed ({exc.code}): {detail}") from exc
        except error.URLError as exc:
            raise RuntimeError(f"Cannot reach API at {self.base_url}: {exc.reason}") from exc


def run_demo(base_url: str, timeout: int) -> None:
    client = DemoClient(base_url)
    suffix = datetime.now(UTC).strftime("%Y%m%d%H%M%S%f")

    print("=== OpenClaw Agent Runtime MVP Demo ===")
    print("1. Login")
    try:
        login = client.call(
            "POST",
            "/api/v1/auth/login",
            {"email": "admin@example.com", "password": "ChangeMe123456!"},
        )
    except RuntimeError as exc:
        raise RuntimeError(f"{exc}. Run `python scripts/seed.py` before the demo.") from exc
    client.token = login["data"]["access_token"]
    print("   OK: authenticated")

    print("2. Register builtin calculator Tool")
    tool_name = f"demo-calculator-{suffix}"
    tool = client.call(
        "POST",
        "/api/v1/tools",
        {
            "name": tool_name,
            "description": "MVP demo calculator",
            "executor": "builtin.add",
            "input_schema": {
                "type": "object",
                "properties": {"left": {"type": "number"}, "right": {"type": "number"}},
                "required": ["left", "right"],
            },
            "output_schema": {
                "type": "object",
                "properties": {"sum": {"type": "number"}},
                "required": ["sum"],
            },
        },
    )["data"]
    print(f"   OK: tool_id={tool['id']}")

    print("3. Create Agent draft with prepare -> tool -> finalize DAG")
    agent = client.call(
        "POST",
        "/api/v1/agents",
        {
            "name": f"Demo Calculator Agent {suffix}",
            "definition": {
                "workflow": [
                    {"key": "prepare", "type": "prepare"},
                    {
                        "key": "calculate",
                        "type": "tool",
                        "tool_name": tool_name,
                        "input": {"left": 10, "right": 5},
                        "depends_on": ["prepare"],
                    },
                    {"key": "finalize", "type": "finalize", "depends_on": ["calculate"]},
                ]
            },
        },
    )["data"]
    print(f"   OK: agent_id={agent['id']}, status={agent['status']}")

    print("4. Publish immutable Agent version")
    version = client.call("POST", f"/api/v1/agents/{agent['id']}/publish")["data"]
    print(f"   OK: version={version['version']}, digest={version['content_digest'][:12]}...")

    print("5. Create asynchronous Run")
    run = client.call(
        "POST", "/api/v1/runs", {"agent_id": agent["id"], "input": {"prompt": "10 + 5"}}
    )["data"]
    print(f"   OK: run_id={run['id']}, status={run['status']}")

    print("6. Wait for Worker, Tool execution, and checkpoint")
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        run = client.call("GET", f"/api/v1/runs/{run['id']}")["data"]
        if run["status"] in {"completed", "failed", "cancelled", "timed_out", "budget_exceeded"}:
            break
        time.sleep(1)
    else:
        raise TimeoutError(f"Run did not finish within {timeout} seconds")
    print(f"   OK: status={run['status']}, checkpoint_version={run['checkpoint_version']}")
    print(f"   Output: {json.dumps(run.get('output_json'), ensure_ascii=False)}")
    if run["status"] != "completed":
        raise RuntimeError(f"Demo Run ended in {run['status']}")

    print("7. Query tenant-scoped audit trail")
    audits = client.call("GET", f"/api/v1/audit?resource_type=run&resource_id={run['id']}")[
        "data"
    ]
    actions = [event["action"] for event in audits]
    print(f"   OK: actions={actions}")
    if not {"run.accepted", "run.completed"}.issubset(actions):
        raise RuntimeError("Run audit trail is incomplete")
    print("=== Demo completed successfully ===")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--timeout", type=int, default=60)
    args = parser.parse_args()
    try:
        run_demo(args.base_url, args.timeout)
    except (RuntimeError, TimeoutError, KeyError, json.JSONDecodeError) as exc:
        print(f"Demo failed: {exc}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
