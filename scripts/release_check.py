"""Release-time static gates that do not require external services."""

import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def check_contracts() -> None:
    import yaml

    yaml.safe_load((ROOT / "project/docs/openapi/openapi.yaml").read_text(encoding="utf-8"))
    json.loads((ROOT / "project/docs/schemas/runtime-contract.schema.json").read_text(encoding="utf-8"))


def check_secrets() -> None:
    patterns = (
        re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
        re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
        re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{30,}\b"),
    )
    excluded = {
        ".git",
        "node_modules",
        ".next",
        "data",
        "dist",
        "build",
        "__pycache__",
        "models",
        ".venv",
        ".venv-task023",
        ".venv-task023-full",
        ".archive",
        ".pytest_cache",
        ".ruff_cache",
        "test-results",
        "automation-logs",
    }
    binary_suffixes = {
        ".dump", ".rdb", ".onnx", ".safetensors", ".bin", ".node", ".dll",
        ".exe", ".png", ".jpg", ".jpeg", ".gif", ".zip", ".pdf", ".docx",
    }
    for directory, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [
            name for name in dirnames
            if name not in excluded and not name.startswith(".next-")
        ]
        for filename in filenames:
            path = Path(directory) / filename
            if any(part in excluded or part.startswith(".next-") for part in path.relative_to(ROOT).parts):
                continue
            if path.suffix.lower() in binary_suffixes or path.stat().st_size > 5 * 1024 * 1024:
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                continue
            if any(pattern.search(text) for pattern in patterns):
                raise SystemExit(f"SECRET_PATTERN_FOUND:{path.relative_to(ROOT)}")


if __name__ == "__main__":
    check_contracts()
    check_secrets()
    print("release-check-ok")
