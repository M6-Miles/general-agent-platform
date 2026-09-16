import json
from collections.abc import Iterator
from typing import Any, Protocol
from urllib import error, request

from app.config import Settings
from app.observability import observe_model_api, record_model_usage, timer
from app.runtime import mock_model


def _record_provider_result(started: float, result: dict[str, Any]) -> dict[str, Any]:
    observe_model_api(timer() - started)
    usage = result.get("usage") or {}
    record_model_usage(int(usage.get("total_tokens", 0) or 0), float(result.get("cost_usd", 0) or 0))
    return result


class ModelProvider(Protocol):
    def complete(self, prompt: str, context: dict[str, Any]) -> dict[str, Any]: ...

    def complete_stream(self, prompt: str, context: dict[str, Any]) -> Iterator[str]: ...


class MockModelProvider:
    def complete(self, prompt: str, context: dict[str, Any]) -> dict[str, Any]:
        started = timer()
        return _record_provider_result(started, mock_model(prompt, context))

    def complete_stream(self, prompt: str, context: dict[str, Any]) -> Iterator[str]:
        result = self.complete(prompt, context)
        text = str(result.get("text", ""))
        yield from (text[index:index + 24] for index in range(0, len(text), 24))


class OpenAICompatibleProvider:
    def __init__(self, settings: Settings) -> None:
        if not settings.model_api_key:
            raise ValueError("MODEL_API_KEY_REQUIRED")
        self.settings = settings

    def complete(self, prompt: str, context: dict[str, Any]) -> dict[str, Any]:
        started = timer()
        payload = {"model": self.settings.model_name, "messages": [{"role": "user", "content": prompt}], "metadata": {"context_keys": sorted(context.keys())}}
        req = request.Request(f"{self.settings.model_base_url.rstrip('/')}/chat/completions", data=json.dumps(payload).encode(), headers={"Authorization": f"Bearer {self.settings.model_api_key}", "Content-Type": "application/json"}, method="POST")
        try:
            with request.urlopen(req, timeout=self.settings.model_timeout_seconds) as response:
                body = json.loads(response.read())
        except error.HTTPError as exc:
            if exc.code == 429 or 500 <= exc.code < 600:
                raise ValueError("MODEL_PROVIDER_TRANSIENT") from exc
            raise ValueError("MODEL_PROVIDER_REJECTED") from exc
        except (error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise ValueError("MODEL_PROVIDER_UNAVAILABLE") from exc
        try:
            text = body["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise ValueError("MODEL_PROVIDER_INVALID_RESPONSE") from exc
        usage = body.get("usage") or {}
        return _record_provider_result(started, {
            "text": text,
            "provider": "openai_compatible",
            "model": self.settings.model_name,
            "usage": {
                "prompt_tokens": int(usage.get("prompt_tokens", 0) or 0),
                "completion_tokens": int(usage.get("completion_tokens", 0) or 0),
                "total_tokens": int(usage.get("total_tokens", 0) or 0),
            },
        })

    def complete_stream(self, prompt: str, context: dict[str, Any]) -> Iterator[str]:
        started = timer()
        payload = {"model": self.settings.model_name, "messages": [{"role": "user", "content": prompt}], "stream": True, "metadata": {"context_keys": sorted(context.keys())}}
        req = request.Request(f"{self.settings.model_base_url.rstrip('/')}/chat/completions", data=json.dumps(payload).encode(), headers={"Authorization": f"Bearer {self.settings.model_api_key}", "Content-Type": "application/json", "Accept": "text/event-stream"}, method="POST")
        collected = []
        usage: dict[str, Any] = {}
        try:
            with request.urlopen(req, timeout=self.settings.model_timeout_seconds) as response:
                for raw_line in response:
                    line = raw_line.decode("utf-8", errors="replace").strip()
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        body = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    usage.update(body.get("usage") or {})
                    choices = body.get("choices") or []
                    delta = (choices[0].get("delta") or {}).get("content") if choices else None
                    if delta:
                        collected.append(delta)
                        yield delta
        except error.HTTPError as exc:
            if exc.code == 429 or 500 <= exc.code < 600:
                raise ValueError("MODEL_PROVIDER_TRANSIENT") from exc
            raise ValueError("MODEL_PROVIDER_REJECTED") from exc
        except (error.URLError, TimeoutError) as exc:
            raise ValueError("MODEL_PROVIDER_UNAVAILABLE") from exc
        _record_provider_result(started, {"text": "".join(collected), "provider": "openai_compatible", "model": self.settings.model_name, "usage": usage})


def get_model_provider(settings: Settings) -> ModelProvider:
    return OpenAICompatibleProvider(settings) if settings.model_provider == "openai_compatible" else MockModelProvider()
