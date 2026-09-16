"""Embedding provider abstraction and deterministic local fallback."""

import hashlib
import math
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from app.config import Settings


class EmbeddingProvider(Protocol):
    def embed(self, text: str) -> list[float]: ...

    def embed_batch(self, texts: list[str]) -> list[list[float]]: ...


_PROVIDER_CACHE: dict[str, EmbeddingProvider] = {}


class MockEmbeddingProvider:
    dimensions = 32
    model_name = "mock"

    def embed(self, text: str) -> list[float]:
        raw = hashlib.sha256(text.encode("utf-8")).digest()
        values = [((raw[i % len(raw)] / 255.0) * 2.0) - 1.0 for i in range(self.dimensions)]
        norm = math.sqrt(sum(value * value for value in values)) or 1.0
        return [round(value / norm, 8) for value in values]

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [self.embed(text) for text in texts]


class SentenceTransformerEmbeddingProvider:
    """Semantic embeddings backed by a local sentence-transformers model."""

    def __init__(self, model_name: str) -> None:
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:  # pragma: no cover - dependency is part of normal installs
            raise RuntimeError(
                "sentence-transformers is required when EMBEDDING_PROVIDER="
                "sentence_transformers"
            ) from exc
        self.model_name = model_name
        self.dimensions = 384
        self._model = SentenceTransformer(model_name)

    def embed(self, text: str) -> list[float]:
        vector = self._model.encode(text, normalize_embeddings=True)
        return [float(value) for value in vector]

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        vectors = self._model.encode(texts, normalize_embeddings=True)
        return [[float(value) for value in vector] for vector in vectors]


def _create_provider(settings: "Settings") -> EmbeddingProvider:
    provider = settings.embedding_provider.strip().lower()
    if provider == "mock":
        return MockEmbeddingProvider()
    if provider == "sentence_transformers":
        return SentenceTransformerEmbeddingProvider(settings.embedding_model)
    raise ValueError(f"Unsupported embedding provider: {settings.embedding_provider}")


def get_embedding_provider(settings: "Settings | None" = None) -> EmbeddingProvider:
    if settings is None:
        try:
            from app.config_secrets import get_settings_with_secrets
            settings = get_settings_with_secrets()
        except ImportError:
            from app.config import get_settings
            settings = get_settings()
    cache_key = f"{settings.embedding_provider.strip().lower()}:{settings.embedding_model}"
    if cache_key not in _PROVIDER_CACHE:
        _PROVIDER_CACHE[cache_key] = _create_provider(settings)
    return _PROVIDER_CACHE[cache_key]


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or len(left) != len(right):
        return 0.0
    return sum(a * b for a, b in zip(left, right, strict=True))
