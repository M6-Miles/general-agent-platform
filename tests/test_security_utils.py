from app.security_utils import redact_json, redact_secrets


def test_redact_json_sensitive_keys_and_nested_values():
    value = {"password": "hunter2", "nested": [{"api_key": "sk-123456789012"}], "message": "Bearer abc"}
    result = redact_json(value)
    assert result["password"] == "***REDACTED***"
    assert result["nested"][0]["api_key"] == "***REDACTED***"
    assert "***REDACTED***" in result["message"]


def test_redact_secrets_handles_connection_strings():
    result = redact_secrets("connect postgres://user:pass@host/db")
    assert "postgres://" not in result
    assert "***REDACTED***" in result
