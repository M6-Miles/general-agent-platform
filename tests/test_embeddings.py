import math
import sys
from types import SimpleNamespace

import pytest

from app.config import Settings
from app.embeddings import (
    _PROVIDER_CACHE,
    MockEmbeddingProvider,
    SentenceTransformerEmbeddingProvider,
    cosine_similarity,
    get_embedding_provider,
)


def test_mock_embedding_is_deterministic_normalized_and_text_sensitive():
    provider = MockEmbeddingProvider()
    first = provider.embed("hello")
    repeated = provider.embed("hello")
    different = provider.embed("world")

    assert first == repeated
    assert first != different
    assert len(first) == provider.dimensions
    assert math.isclose(sum(value * value for value in first), 1.0, rel_tol=1e-7)


def test_mock_embedding_batch_matches_single_embeddings():
    provider = MockEmbeddingProvider()
    texts = ["first", "second", ""]
    assert provider.embed_batch(texts) == [provider.embed(text) for text in texts]


def test_embedding_provider_is_cached_for_same_configuration():
    _PROVIDER_CACHE.clear()
    settings = Settings(secret_key="x" * 32, embedding_provider="mock", embedding_model="cached")
    assert get_embedding_provider(settings) is get_embedding_provider(settings)


def test_embedding_provider_factory_returns_local_fallback():
    provider = get_embedding_provider()
    assert isinstance(provider, MockEmbeddingProvider)
    assert len(provider.embed("offline")) == 32


def test_sentence_transformer_provider_produces_normalized_semantic_vectors(monkeypatch):
    class FakeModel:
        def __init__(self, model_name):
            assert model_name == "test-model"

        def encode(self, text, normalize_embeddings):
            assert normalize_embeddings is True
            return [0.8, 0.6] if "苹果" in text else [-0.8, 0.6]

    monkeypatch.setitem(
        sys.modules,
        "sentence_transformers",
        SimpleNamespace(SentenceTransformer=FakeModel),
    )
    settings = Settings(
        secret_key="x" * 32,
        embedding_provider="sentence_transformers",
        embedding_model="test-model",
    )

    provider = get_embedding_provider(settings)
    assert isinstance(provider, SentenceTransformerEmbeddingProvider)
    related = cosine_similarity(provider.embed("苹果是一种水果"), provider.embed("水果包括苹果"))
    unrelated = cosine_similarity(provider.embed("苹果是一种水果"), provider.embed("量子物理"))
    assert related > 0.7
    assert unrelated < 0.3


def test_embedding_provider_factory_rejects_unknown_provider():
    settings = Settings(secret_key="x" * 32, embedding_provider="unknown")
    with pytest.raises(ValueError, match="Unsupported embedding provider"):
        get_embedding_provider(settings)


def test_cosine_similarity_handles_equal_mismatch_and_empty_vectors():
    assert cosine_similarity([1.0, 0.0], [1.0, 0.0]) == 1.0
    assert cosine_similarity([1.0, 0.0], [0.0, 1.0]) == 0.0
    assert cosine_similarity([], []) == 0.0
    assert cosine_similarity([1.0], [1.0, 2.0]) == 0.0
