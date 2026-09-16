from types import SimpleNamespace

from app.embeddings import MockEmbeddingProvider
from app.retrieval import BM25Retriever, CrossEncoderReranker, HybridRetriever


def docs():
    return [
        SimpleNamespace(content="FastAPI exposes an HTTP API", embedding_json=MockEmbeddingProvider().embed("FastAPI exposes an HTTP API")),
        SimpleNamespace(content="PostgreSQL provides relational storage", embedding_json=MockEmbeddingProvider().embed("PostgreSQL provides relational storage")),
        SimpleNamespace(content="Redis is an in-memory cache", embedding_json=MockEmbeddingProvider().embed("Redis is an in-memory cache")),
    ]


def test_bm25_matches_exact_keyword():
    results = BM25Retriever(docs()).search("PostgreSQL", top_k=1)
    assert results[0].item.content.startswith("PostgreSQL")


def test_bm25_handles_empty_documents():
    assert BM25Retriever([]).search("anything") == []


def test_hybrid_fuses_keyword_and_vector_results():
    results = HybridRetriever(docs(), MockEmbeddingProvider()).search("FastAPI", top_k=3)
    assert len(results) == 3
    assert {result.item.content for result in results} >= {"FastAPI exposes an HTTP API", "PostgreSQL provides relational storage"}


def test_hybrid_weights_are_configurable():
    retriever = HybridRetriever(docs(), MockEmbeddingProvider(), bm25_weight=1.0, vector_weight=0.0)
    assert retriever.search("Redis", top_k=1)[0].item.content.startswith("Redis")


def test_cross_encoder_reranks_candidates(monkeypatch):
    class FakeModel:
        def predict(self, pairs):
            return [0.1, 0.9, 0.2]

    reranker = CrossEncoderReranker("fake")
    monkeypatch.setattr(reranker, "_model", lambda: FakeModel())
    results = reranker.rerank("query", docs(), top_k=2)
    assert [result.item.content for result in results] == [
        "PostgreSQL provides relational storage",
        "Redis is an in-memory cache",
    ]


def test_hybrid_reranker_falls_back_when_model_unavailable():
    class BrokenReranker:
        def rerank(self, *args, **kwargs):
            raise RuntimeError("offline")

    results = HybridRetriever(docs(), MockEmbeddingProvider(), reranker=BrokenReranker(), enable_reranker=True).search("FastAPI", top_k=2)
    assert len(results) == 2
