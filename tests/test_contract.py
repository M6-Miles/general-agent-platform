from pathlib import Path

import yaml

from app.main import app
from scripts.contract_check import normalize_path_params


def _normalize(path: str) -> str:
    return (
        (path.removeprefix("/api/v1") or "/")
        .replace("{agentId}", "{agent_id}")
        .replace("{runId}", "{run_id}")
        .replace("{approvalId}", "{approval_id}")
        .replace("{skillId}", "{skill_id}")
        .replace("{messageId}", "{message_id}")
        .replace("{tenantId}", "{tenant_id}")
    )


def test_versioned_openapi_paths_exist_in_runtime():
    root = Path(__file__).resolve().parents[1]
    contract = yaml.safe_load((root / "project/docs/openapi/openapi.yaml").read_text(encoding="utf-8"))
    actual = {_normalize(path): set(item) for path, item in app.openapi()["paths"].items()}
    for path, operations in contract["paths"].items():
        assert _normalize(path) in actual
        assert set(operations) <= actual[_normalize(path)]


def test_openapi_contract_has_shared_error_and_pagination_schemas():
    root = Path(__file__).resolve().parents[1]
    contract = yaml.safe_load((root / "project/docs/openapi/openapi.yaml").read_text(encoding="utf-8"))
    schemas = contract["components"]["schemas"]
    assert "ErrorEnvelope" in schemas
    assert "PageMeta" in schemas
    assert schemas["PageMeta"]["properties"]["nextCursor"]["type"] == "string"


def test_contract_path_parameter_normalization_is_generic():
    assert normalize_path_params('/skills/{skillId}') == '/skills/{skill_id}'
    assert normalize_path_params('/runs/{runId}/messages/{messageID}') == '/runs/{run_id}/messages/{message_id}'
    assert normalize_path_params('/agents/{agent_id}') == '/agents/{agent_id}'


def test_contract_normalization_does_not_hide_missing_route():
    runtime = {normalize_path_params('/skills/{skill_id}')}
    assert normalize_path_params('/skills/{skillId}') in runtime
    assert normalize_path_params('/missing') not in runtime
