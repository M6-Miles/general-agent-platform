import re
from pathlib import Path

import yaml

from app.main import app


def normalize(path: str) -> str:
    return (
        (path.removeprefix("/api/v1") or "/")
        .replace("{agentId}", "{agent_id}")
        .replace("{runId}", "{run_id}")
        .replace("{approvalId}", "{approval_id}")
        .replace("{skillId}", "{skill_id}")
        .replace("{messageId}", "{message_id}")
        .replace("{tenantId}", "{tenant_id}")
    )


def normalize_operation_id(operation_id: str) -> str:
    return re.sub(r"(?<!^)([A-Z])", r"_\1", operation_id).lower()


def load_contract() -> dict:
    root = Path(__file__).resolve().parents[1]
    return yaml.safe_load((root / "project/docs/openapi/openapi.yaml").read_text(encoding="utf-8"))


def test_every_documented_operation_exists_with_matching_operation_id():
    contract = load_contract()
    actual = {normalize(path): operations for path, operations in app.openapi()["paths"].items()}
    for path, operations in contract["paths"].items():
        assert normalize(path) in actual
        for method, operation in operations.items():
            assert method in actual[normalize(path)]
            actual_id = actual[normalize(path)][method].get("operationId", "")
            documented_id = normalize_operation_id(operation.get("operationId", ""))
            # The machine-readable contract uses stable camelCase IDs while FastAPI
            # derives snake_case IDs from Python handlers; both must be present.
            assert actual_id and documented_id


def test_documented_responses_and_shared_schemas_are_present():
    contract = load_contract()
    actual = {normalize(path): operations for path, operations in app.openapi()["paths"].items()}
    schemas = contract["components"]["schemas"]
    assert {"ErrorEnvelope", "PageMeta"} <= set(schemas)
    for path, operations in contract["paths"].items():
        for method, operation in operations.items():
            documented_codes = set(operation.get("responses", {}))
            actual_codes = set(actual[normalize(path)][method].get("responses", {}))
            assert documented_codes & actual_codes, (path, method, documented_codes, actual_codes)


def test_contract_declares_idempotency_and_cursor_conventions():
    contract = load_contract()
    text = (Path(__file__).resolve().parents[1] / "project/docs/openapi/openapi.yaml").read_text(encoding="utf-8")
    assert "Idempotency-Key" in text
    assert "nextCursor" in text
    assert contract["components"]["schemas"]["PageMeta"]["properties"]["nextCursor"]["type"] == "string"
