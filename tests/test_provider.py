import json
import os
from unittest.mock import patch
from urllib.error import HTTPError, URLError

import pytest

os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-characters")

from app.config import Settings
from app.providers import MockModelProvider, OpenAICompatibleProvider, get_model_provider


class FakeResponse:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return json.dumps({"choices": [{"message": {"content": "ok"}}]}).encode()


def test_openai_compatible_provider_contract():
    settings = Settings(
        secret_key="test-secret-key-with-at-least-32-characters",
        model_provider="openai_compatible",
        model_api_key="test-key",
        model_base_url="https://model.example/v1",
    )
    provider = OpenAICompatibleProvider(settings)
    with patch("app.providers.request.urlopen", return_value=FakeResponse()) as mocked:
        result = provider.complete("hello", {"tenant": "t1"})
    assert result["text"] == "ok"
    assert result["provider"] == "openai_compatible"
    assert mocked.call_args.args[0].full_url.endswith("/chat/completions")


def test_provider_classifies_transient_http_errors():
    settings = Settings(secret_key="test-secret-key-with-at-least-32-characters", model_provider="openai_compatible", model_api_key="test-key")
    provider = OpenAICompatibleProvider(settings)
    with patch("app.providers.request.urlopen", side_effect=HTTPError("https://model.example", 429, "busy", {}, None)):
        try:
            provider.complete("hello", {})
        except ValueError as exc:
            assert str(exc) == "MODEL_PROVIDER_TRANSIENT"
        else:
            raise AssertionError("expected transient provider error")


def test_mock_provider_returns_deterministic_response():
    provider = MockModelProvider()
    first = provider.complete("hello", {"tenant": "t1"})
    repeated = provider.complete("hello", {"tenant": "t1"})
    assert first == repeated
    assert first["text"] == "mock:hello"
    assert first["context_keys"] == ["tenant"]
    assert first["usage"]["total_tokens"] == 0


def test_provider_factory_selects_mock_and_requires_key_for_remote():
    mock_settings = Settings(secret_key="test-secret-key-with-at-least-32-characters", model_provider="mock")
    assert isinstance(get_model_provider(mock_settings), MockModelProvider)
    remote_settings = Settings(
        secret_key="test-secret-key-with-at-least-32-characters",
        model_provider="openai_compatible",
        model_api_key=None,
    )
    with pytest.raises(ValueError, match="MODEL_API_KEY_REQUIRED"):
        get_model_provider(remote_settings)


@pytest.mark.parametrize(
    ("exception", "expected"),
    [
        (HTTPError("https://model.example", 400, "bad", {}, None), "MODEL_PROVIDER_REJECTED"),
        (URLError("offline"), "MODEL_PROVIDER_UNAVAILABLE"),
    ],
)
def test_provider_classifies_non_retryable_and_network_errors(exception, expected):
    settings = Settings(
        secret_key="test-secret-key-with-at-least-32-characters",
        model_provider="openai_compatible",
        model_api_key="test-key",
    )
    provider = OpenAICompatibleProvider(settings)
    with patch("app.providers.request.urlopen", side_effect=exception), pytest.raises(ValueError, match=expected):
        provider.complete("hello", {})


def test_provider_rejects_invalid_response_shape():
    settings = Settings(
        secret_key="test-secret-key-with-at-least-32-characters",
        model_provider="openai_compatible",
        model_api_key="test-key",
    )
    provider = OpenAICompatibleProvider(settings)

    class InvalidResponse(FakeResponse):
        def read(self):
            return b"{}"

    with patch("app.providers.request.urlopen", return_value=InvalidResponse()), pytest.raises(ValueError, match="MODEL_PROVIDER_INVALID_RESPONSE"):
        provider.complete("hello", {})
