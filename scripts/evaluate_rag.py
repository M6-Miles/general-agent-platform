"""Evaluate embedding retrieval quality on the bundled RAG benchmark."""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.config import Settings
from app.embeddings import EmbeddingProvider, cosine_similarity, get_embedding_provider
from app.retrieval import HybridRetriever

DEFAULT_DATASET = ROOT / "tests" / "data" / "rag_eval_dataset.json"
DEFAULT_OUTPUT = ROOT / "docs" / "RAG_EVALUATION_REPORT.md"
DEFAULT_LOCAL_MODEL = ROOT / "models" / "embedding"


@dataclass(frozen=True)
class EvaluationResult:
    sample_count: int
    recall_at_5: float
    recall_at_10: float
    mrr: float
    average_retrieval_ms: float


def load_dataset(path: Path) -> list[dict[str, str]]:
    samples = json.loads(path.read_text(encoding="utf-8"))
    required = {"id", "question", "answer", "document"}
    if not isinstance(samples, list) or len(samples) < 50:
        raise ValueError("RAG evaluation dataset must contain at least 50 samples")
    if any(not isinstance(item, dict) or not required <= item.keys() for item in samples):
        raise ValueError(f"Each sample must contain: {', '.join(sorted(required))}")
    return samples


def evaluate(samples: list[dict[str, str]], provider: EmbeddingProvider, retrieval_mode: str = "vector_only") -> EvaluationResult:
    if retrieval_mode == "hybrid":
        documents = [type("Document", (), {"content": sample["document"], "embedding_json": provider.embed(sample["document"])})() for sample in samples]
        retriever = HybridRetriever(documents, provider)
    else:
        retriever = None
    document_vectors = [provider.embed(sample["document"]) for sample in samples]
    hits_at_5 = 0
    hits_at_10 = 0
    reciprocal_rank = 0.0
    retrieval_seconds = 0.0
    for expected_index, sample in enumerate(samples):
        started = time.perf_counter()
        if retriever:
            ranked_items = retriever.search(sample["question"], len(samples))
            ranked = [documents.index(result.item) for result in ranked_items]
        else:
            query_vector = provider.embed(sample["question"])
            ranked = sorted(range(len(samples)), key=lambda index: cosine_similarity(query_vector, document_vectors[index]), reverse=True)
        retrieval_seconds += time.perf_counter() - started
        rank = ranked.index(expected_index) + 1
        hits_at_5 += rank <= 5
        hits_at_10 += rank <= 10
        reciprocal_rank += 1.0 / rank
    count = len(samples)
    return EvaluationResult(
        sample_count=count,
        recall_at_5=hits_at_5 / count,
        recall_at_10=hits_at_10 / count,
        mrr=reciprocal_rank / count,
        average_retrieval_ms=(retrieval_seconds / count) * 1000,
    )


def render_report(result: EvaluationResult, dataset_path: Path, model_name: str) -> str:
    return f"""# RAG Evaluation Report

- Dataset: {dataset_path}
- Samples: {result.sample_count}
- Embedding model: {model_name}

## Retrieval metrics

| Metric | Result |
|---|---:|
| Recall@5 | {result.recall_at_5:.2%} |
| Recall@10 | {result.recall_at_10:.2%} |
| MRR | {result.mrr:.4f} |
| Average retrieval time | {result.average_retrieval_ms:.2f} ms/query |

Recall@K measures whether the correct document appears in the first K results.
MRR rewards systems that rank the correct document nearer to first place.
"""


def build_provider(model: str | None = None) -> tuple[EmbeddingProvider, str]:
    local_model = (
        str(DEFAULT_LOCAL_MODEL)
        if DEFAULT_LOCAL_MODEL.joinpath("model.safetensors").exists()
        else None
    )
    model_name = model or local_model or "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    settings = Settings(
        secret_key="rag-evaluation-only-secret-key-32",
        embedding_provider="sentence_transformers",
        embedding_model=model_name,
    )
    return get_embedding_provider(settings), model_name


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--model", help="Local model path or Hugging Face model id")
    parser.add_argument("--retrieval-mode", choices=("vector_only", "hybrid"), default="vector_only")
    args = parser.parse_args()
    samples = load_dataset(args.dataset)
    provider, model_name = build_provider(args.model)
    result = evaluate(samples, provider, args.retrieval_mode)
    report = render_report(result, args.dataset, model_name)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(report, encoding="utf-8")
    print(report)
    return 0 if result.recall_at_10 > 0.70 else 1


if __name__ == "__main__":
    raise SystemExit(main())
