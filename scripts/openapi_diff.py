#!/usr/bin/env python3
"""Report documented versus runtime API path coverage."""
import json
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "project/docs/openapi/openapi.yaml"
INTERNAL_PREFIXES = ("/health", "/ready", "/metrics", "/openapi.json", "/docs", "/redoc", "/console")


def normalize(path: str) -> str:
    """Align contract paths with the versioned runtime route representation."""
    return (
        (path.removeprefix("/api/v1") or "/")
        .replace("{agentId}", "{agent_id}")
        .replace("{runId}", "{run_id}")
        .replace("{approvalId}", "{approval_id}")
        .replace("{tenantId}", "{tenant_id}")
        .replace("{skillId}", "{skill_id}")
        .replace("{messageId}", "{message_id}")
    )


def main() -> int:
    from app.main import app

    contract = yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))
    documented = {normalize(path) for path in contract.get("paths", {})}
    runtime = {normalize(route.path) for route in app.routes if hasattr(route, "path")}
    missing = sorted(runtime - documented)
    extra = sorted(documented - runtime)
    internal = [path for path in missing if path.startswith(INTERNAL_PREFIXES)]
    business = [path for path in missing if path not in internal]
    print(json.dumps({"documented": len(documented), "runtime": len(runtime), "internal_undocumented": internal, "business_undocumented": business, "stale_documented": extra}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
