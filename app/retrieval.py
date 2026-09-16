"""Keyword, vector, and hybrid retrieval primitives for knowledge chunks."""

from __future__ import annotations

import logging
import re
import threading
from collections.abc import Callable, Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Any, ClassVar

from app.embeddings import EmbeddingProvider, cosine_similarity

logger = logging.getLogger(__name__)

try:  # Optional at import time so the portable test environment still works.
    from rank_bm25 import BM25Okapi
except ImportError:  # pragma: no cover - exercised only before dependency install
    BM25Okapi = None


def tokenize(text: str) -> list[str]:
    """Tokenize Latin words and CJK terms; jieba is used when available."""
    try:
        import jieba

        tokens = list(jieba.cut(text, cut_all=False))
    except ImportError:  # pragma: no cover - dependency is installed normally
        tokens = re.findall(r"[A-Za-z0-9_]+|[\u4e00-\u9fff]", text)
    return [token.lower() for token in tokens if token.strip()]


@dataclass(frozen=True)
class RetrievalResult:
    score: float
    item: Any


class CrossEncoderReranker:
    """Rerank candidates with a cached sentence-transformers CrossEncoder."""

    _cache: ClassVar[dict[str, Any]] = {}
    _lock = threading.Lock()

    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2") -> None:
        self.model_name = model_name

    def _model(self) -> Any:
        model = self._cache.get(self.model_name)
        if model is not None:
            return model
        try:
            from sentence_transformers import CrossEncoder
        except ImportError as exc:  # pragma: no cover - dependency is optional in tests
            raise RuntimeError("sentence-transformers is required for reranking") from exc
        with self._lock:
            model = self._cache.get(self.model_name)
            if model is None:
                model = CrossEncoder(self.model_name)
                self._cache[self.model_name] = model
        return model

    def rerank(self, query: str, documents: Sequence[Any], top_k: int = 10,
               text_getter: Callable[[Any], str] | None = None) -> list[RetrievalResult]:
        candidates = list(documents)
        if not candidates:
            return []
        getter = text_getter or (lambda item: item.content if hasattr(item, "content") else str(item))
        scores = self._model().predict([(query, getter(item)) for item in candidates])
        ranked = sorted(zip(scores, candidates), key=lambda pair: float(pair[0]), reverse=True)
        return [RetrievalResult(float(score), item) for score, item in ranked[:top_k]]


class BM25Retriever:
    def __init__(self, documents: Sequence[Any], text_getter: Callable[[Any], str] | None = None) -> None:
        self.documents = list(documents)
        self.text_getter = text_getter or (lambda item: item.content if hasattr(item, "content") else str(item))
        self._tokens = [tokenize(self.text_getter(item)) for item in self.documents]
        self._bm25 = BM25Okapi(self._tokens) if BM25Okapi and self._tokens else None

    def search(self, query: str, top_k: int = 10) -> list[RetrievalResult]:
        if not self.documents:
            return []
        query_tokens = tokenize(query)
        if self._bm25:
            scores = self._bm25.get_scores(query_tokens)
        else:
            # Small fallback scoring keeps local development usable without rank-bm25.
            scores = [sum(token in tokens for token in set(query_tokens)) for tokens in self._tokens]
        ranked = sorted(enumerate(scores), key=lambda pair: pair[1], reverse=True)[:top_k]
        return [RetrievalResult(float(score), self.documents[index]) for index, score in ranked]


class HybridRetriever:
    """Fuse BM25 and vector rankings with weighted reciprocal rank fusion."""

    def __init__(
        self,
        documents: Sequence[Any],
        embedding_provider: EmbeddingProvider,
        text_getter: Callable[[Any], str] | None = None,
        vector_getter: Callable[[Any], list[float]] | None = None,
        bm25_weight: float = 0.3,
        vector_weight: float = 0.7,
        reranker: CrossEncoderReranker | None = None,
        enable_reranker: bool = False,
    ) -> None:
        self.documents = list(documents)
        self.embedding_provider = embedding_provider
        self.vector_getter = vector_getter or (lambda item: item.embedding_json)
        self.bm25_weight = bm25_weight
        self.vector_weight = vector_weight
        self.reranker = reranker
        self.enable_reranker = enable_reranker
        self.bm25 = BM25Retriever(self.documents, text_getter)

    def _vector_search(self, query: str, top_k: int) -> list[RetrievalResult]:
        query_vector = self.embedding_provider.embed(query)
        ranked = sorted(
            (RetrievalResult(cosine_similarity(query_vector, self.vector_getter(item)), item) for item in self.documents),
            key=lambda result: result.score,
            reverse=True,
        )
        return ranked[:top_k]

    def search(self, query: str, top_k: int = 10) -> list[RetrievalResult]:
        with ThreadPoolExecutor(max_workers=2) as pool:
            bm25_future = pool.submit(self.bm25.search, query, top_k)
            vector_future = pool.submit(self._vector_search, query, top_k)
            bm25_results, vector_results = bm25_future.result(), vector_future.result()
        fused: dict[int, float] = {}
        items: dict[int, Any] = {}
        for weight, results in ((self.bm25_weight, bm25_results), (self.vector_weight, vector_results)):
            for rank, result in enumerate(results, start=1):
                key = id(result.item)
                items[key] = result.item
                fused[key] = fused.get(key, 0.0) + weight / (60 + rank)
        results = [RetrievalResult(score, items[key]) for key, score in sorted(fused.items(), key=lambda pair: pair[1], reverse=True)[:top_k]]
        if self.enable_reranker:
            try:
                reranker = self.reranker or CrossEncoderReranker()
                return reranker.rerank(query, [result.item for result in results], top_k)
            except (RuntimeError, OSError) as exc:
                logger.warning("Reranker unavailable; returning hybrid ranking: %s", exc)
        return results
