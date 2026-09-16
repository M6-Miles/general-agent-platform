"""Utilities for preventing secrets from being persisted or returned."""

import re
from typing import Any

_SENSITIVE_KEY = re.compile(r"(?:password|passwd|token|api[_-]?key|secret|credential|authorization)", re.IGNORECASE)
_SECRET_VALUE = re.compile(r"(?i)(?:bearer\s+\S+|sk-[A-Za-z0-9_-]{12,}|postgres(?:ql)?://[^\s]+)")


def redact_secrets(value: str) -> str:
    """Redact common credential formats in free-form text."""
    return _SECRET_VALUE.sub(
        lambda match: (
            "Bearer ***REDACTED***"
            if match.group(0).lower().startswith("bearer")
            else "***REDACTED***"
        ),
        value,
    )


def redact_json(value: Any, *, _key: str | None = None) -> Any:
    """Recursively redact sensitive mapping fields and embedded secret strings."""
    if _key and _SENSITIVE_KEY.search(_key):
        return "***REDACTED***"
    if isinstance(value, dict):
        return {str(key): redact_json(item, _key=str(key)) for key, item in value.items()}
    if isinstance(value, list):
        return [redact_json(item) for item in value]
    if isinstance(value, str):
        return redact_secrets(value)
    return value
