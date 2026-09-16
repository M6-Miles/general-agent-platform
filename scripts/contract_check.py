"""Validate the versioned HTTP contract against the running FastAPI routes."""
import json
import re
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "project" / "docs" / "openapi" / "openapi.yaml"


def normalize_path_params(path: str) -> str:
    """Normalize versioned contract parameter spelling to FastAPI's snake_case."""
    def camel_to_snake(match: re.Match[str]) -> str:
        value = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", match.group(1)).lower()
        return "{" + value + "}"

    return re.sub(r"\{([a-zA-Z][a-zA-Z0-9_]*)\}", camel_to_snake, path)


def normalize(path: str) -> str:
    value = path.removeprefix("/api/v1") or "/"
    return normalize_path_params(value)


def main() -> None:
    document = yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))
    if document.get("openapi", "").split(".")[0] != "3":
        raise SystemExit("OpenAPI 3 contract required")
    actual = app.openapi()
    actual_paths = {normalize(path): set(item) for path, item in actual["paths"].items()}
    for path, operations in document.get("paths", {}).items():
        normalized = normalize(path)
        if normalized not in actual_paths:
            raise SystemExit(f"documented path missing from FastAPI: {path}")
        for method in operations:
            if method.lower() not in actual_paths[normalized]:
                raise SystemExit(f"documented operation missing from FastAPI: {method.upper()} {path}")
    json.loads((ROOT / "project" / "docs" / "schemas" / "runtime-contract.schema.json").read_text(encoding="utf-8"))
    print(f"contract-ok paths={len(document['paths'])} runtime_paths={len(actual_paths)}")


if __name__ == "__main__":
    main()
