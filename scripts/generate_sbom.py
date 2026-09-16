#!/usr/bin/env python3
"""Generate SBOM artifacts with Syft when it is installed."""

import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    syft = shutil.which("syft")
    if not syft:
        print("SBOM_TOOL_UNAVAILABLE: install Syft to generate release SBOM")
        return 2
    output = ROOT / "sbom"
    output.mkdir(exist_ok=True)
    for name, target in (("python-sbom.json", "."), ("nodejs-sbom.json", "web")):
        subprocess.run([syft, "packages", target, "-o", "json", "--file", str(output / name)], cwd=ROOT, check=True)
    print(f"sbom-generated:{output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
