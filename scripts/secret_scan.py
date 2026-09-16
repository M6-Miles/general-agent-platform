"""Best-effort secret scan that never reads .env files or prints secret values."""
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP = {
    ".env", ".env.production", ".env.local", ".git", "node_modules", ".next",
    "test-results", "data", "models", ".venv", ".venv-task023", ".venv-task023-full",
}
PATTERNS = [(re.compile(r"(?:api[_-]?key|secret[_-]?key|password|token)\s*[=:]\s*[\"']?([A-Za-z0-9_\-]{20,})", re.IGNORECASE), "credential")]


def scan_text() -> list[str]:
    findings = []
    for directory, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [name for name in dirnames if name not in SKIP and not name.startswith((".env", ".next-"))]
        for filename in filenames:
            path = Path(directory) / filename
            if any(part in SKIP or part.startswith((".env", ".next-")) for part in path.relative_to(ROOT).parts):
                continue
            if path.suffix.lower() in {".pyc", ".dump", ".rdb", ".onnx", ".safetensors", ".bin", ".node", ".dll", ".exe", ".png", ".jpg", ".jpeg", ".zip", ".pdf", ".docx"}:
                continue
            try:
                text = path.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            for pattern, label in PATTERNS:
                if pattern.search(text) and not any(marker in text.lower() for marker in (
                    "example", "placeholder", "changeme", "ci-secret-key-with-at-least-32-characters",
                    "test-secret", "evaluation-only", "embedding-rebuild",
                )):
                    findings.append(f"{path.relative_to(ROOT)}: {label} (value redacted)")
    return findings


def scan_git() -> list[str]:
    try:
        result = subprocess.run(
            [
                "git", "-C", str(ROOT), "grep", "-IEn",
                "-e", "api[_-]*key[=:].*[A-Za-z0-9_-]{20,}",
                "-e", "password[=:].*[A-Za-z0-9_-]{20,}", "HEAD", "--",
                ".", ":(exclude)node_modules", ":(exclude)web/.next*",
                ":(exclude)web/node_modules",
                ":(exclude)models", ":(exclude)data", ":(exclude)*.dump",
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            check=False,
        )
    except OSError:
        return []
    return ["git history contains credential-like text (details redacted)"] if result.returncode == 0 else []


if __name__ == "__main__":
    findings = scan_text() + scan_git()
    for finding in findings:
        print(f"WARNING: {finding}")
    print(f"secret-scan findings={len(findings)} (env files excluded)")
    sys.exit(1 if findings else 0)
