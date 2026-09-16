import hashlib
import json
import re
from typing import Any

from jsonschema import Draft202012Validator, SchemaError

SEMVER = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$")
ALLOWED_RISKS = {"low", "medium", "high", "critical"}


def validate_manifest(manifest: dict[str, Any]) -> dict[str, Any]:
    required = {"id", "version", "description", "entrypoint", "license", "riskLevel", "sideEffects"}
    if not required.issubset(manifest):
        raise ValueError("INVALID_SKILL_MANIFEST")
    if not isinstance(manifest["id"], str) or not manifest["id"].strip() or not SEMVER.fullmatch(str(manifest["version"])):
        raise ValueError("INVALID_SKILL_VERSION")
    if manifest["riskLevel"] not in ALLOWED_RISKS or not isinstance(manifest["sideEffects"], bool):
        raise ValueError("INVALID_SKILL_RISK")
    if not isinstance(manifest.get("requiredPermissions", []), list) or not isinstance(manifest.get("dependencies", []), list):
        raise TypeError("INVALID_SKILL_DEPENDENCIES")
    return manifest


def validate_capabilities(capabilities: dict[str, Any]) -> dict[str, Any]:
    allowed = {"networkDomains", "fileRoots", "commands", "maxRuntimeMs", "maxMemoryMb"}
    if set(capabilities) - allowed:
        raise ValueError("INVALID_TOOL_CAPABILITIES")
    for key in ("networkDomains", "fileRoots", "commands"):
        if not isinstance(capabilities.get(key, []), list) or any(not isinstance(item, str) or not item for item in capabilities.get(key, [])):
            raise ValueError("INVALID_TOOL_CAPABILITIES")
    if int(capabilities.get("maxRuntimeMs", 120000)) > 120000 or int(capabilities.get("maxMemoryMb", 512)) > 4096:
        raise ValueError("TOOL_RESOURCE_LIMIT_EXCEEDED")
    return capabilities


def validate_tool_schemas(input_schema: dict[str, Any], output_schema: dict[str, Any]) -> None:
    try:
        Draft202012Validator.check_schema(input_schema or {})
        Draft202012Validator.check_schema(output_schema or {})
    except SchemaError as exc:
        raise ValueError("INVALID_TOOL_SCHEMA") from exc


def content_digest(manifest: dict[str, Any], input_schema: dict[str, Any], output_schema: dict[str, Any]) -> str:
    payload = json.dumps({"manifest": manifest, "input": input_schema, "output": output_schema}, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(payload).hexdigest()


def define_tool(**definition: Any) -> dict[str, Any]:
    manifest = validate_manifest(definition.get("manifest", {}))
    validate_capabilities(definition.get("capabilities", {}))
    validate_tool_schemas(definition.get("input_schema", {}), definition.get("output_schema", {}))
    return {**definition, "content_digest": content_digest(manifest, definition.get("input_schema", {}), definition.get("output_schema", {}))}
