#!/usr/bin/env python3
"""Validate the repository Markdown documentation contract."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_PARTS = {".archive", "node_modules", ".next", ".git"}
FENCE_RE = re.compile(r"^```(.*)$")
LINK_RE = re.compile(r"\[[^\]]+\]\(([^)]+)\)")


def markdown_files() -> list[Path]:
    candidates = [ROOT / "README.md", ROOT / "DELIVERY_CHECKLIST.md", ROOT / "PROJECT_FINAL_REPORT.md"]
    candidates += list((ROOT / "docs").rglob("*.md")) if (ROOT / "docs").exists() else []
    candidates += list((ROOT / "project" / "docs").rglob("*.md")) if (ROOT / "project" / "docs").exists() else []
    return sorted({path for path in candidates if path.exists() and not SKIP_PARTS.intersection(path.parts)})


def check(path: Path) -> list[str]:
    lines = path.read_text(encoding="utf-8").splitlines()
    issues: list[str] = []
    h1 = 0
    in_fence = False
    fence_line = 0
    mermaid = False
    mermaid_title = False
    mermaid_desc = False
    for number, line in enumerate(lines, 1):
        match = FENCE_RE.match(line)
        if match:
            if not in_fence:
                language = match.group(1).strip()
                if not language:
                    issues.append(f"line {number}: fenced code block has no language")
                mermaid = language.lower() == "mermaid"
                mermaid_title = mermaid_desc = False
                fence_line = number
            else:
                if mermaid and (not mermaid_title or not mermaid_desc):
                    issues.append(f"line {fence_line}: mermaid block needs accTitle and accDescr")
                mermaid = False
            in_fence = not in_fence
            continue
        if not in_fence and re.match(r"^#\s+[^#]", line):
            h1 += 1
        if in_fence and mermaid:
            mermaid_title |= line.strip().startswith("accTitle")
            mermaid_desc |= line.strip().startswith("accDescr")
        if not in_fence:
            for target in LINK_RE.findall(line):
                target = target.split("#", 1)[0].strip().strip("<>")
                if not target or re.match(r"(?:https?|mailto):", target):
                    continue
                target_path = (path.parent / target).resolve()
                if not target_path.exists():
                    issues.append(f"line {number}: missing link target {target}")
    if in_fence:
        issues.append(f"line {fence_line}: unclosed code fence")
    if h1 != 1:
        issues.append(f"H1 count is {h1}, expected 1")
    return issues


def main() -> int:
    failures = [(path.relative_to(ROOT), issue) for path in markdown_files() for issue in check(path)]
    if failures:
        for path, issue in failures:
            print(f"{path}: {issue}")
        return 1
    print("docs-check-ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
