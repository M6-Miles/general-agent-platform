"""Fail CI when generated dependencies or runtime data are tracked in Git."""

from __future__ import annotations

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FORBIDDEN = ("/node_modules/", "/.next/", "/.next-", "/data/", "/.venv", ".dump", ".rdb")


def main() -> int:
    result = subprocess.run(
        ["git", "-C", str(ROOT), "ls-files", "-z"],
        check=True,
        capture_output=True,
    )
    tracked = [Path(item.decode()) for item in result.stdout.split(b"\0") if item]
    violations = [
        str(path)
        for path in tracked
        if (
            path.as_posix().startswith(("node_modules/", "web/node_modules/", "web/.next/", "web/.next-", "data/", ".venv"))
            or path.as_posix().endswith((".dump", ".rdb"))
        )
    ]
    if violations:
        print("REPO_HYGIENE_FAILED")
        print("\n".join(violations[:50]))
        print(f"total={len(violations)}")
        return 1
    print(f"repo-hygiene-ok tracked={len(tracked)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
