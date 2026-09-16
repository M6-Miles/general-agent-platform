"""Find API paths that are in runtime but not in OpenAPI documentation."""
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "project" / "docs" / "openapi" / "openapi.yaml"


def normalize(path: str) -> str:
    return path.removeprefix("/api/v1") or "/"


def main() -> None:
    document = yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))
    actual = app.openapi()

    documented_paths = {normalize(path) for path in document.get("paths", {})}
    runtime_paths = {normalize(path) for path in actual["paths"]}

    undocumented = runtime_paths - documented_paths

    if undocumented:
        print("Undocumented paths (in runtime but not in OpenAPI):")
        for path in sorted(undocumented):
            original = next(p for p in actual["paths"] if normalize(p) == path)
            methods = list(actual["paths"][original].keys())
            print(f"  {original} [{', '.join(m.upper() for m in methods)}]")
    else:
        print("All runtime paths are documented")


if __name__ == "__main__":
    main()
