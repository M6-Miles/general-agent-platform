from pathlib import Path

from scripts.evaluate_rag import evaluate, load_dataset, render_report


class TokenEmbeddingProvider:
    def __init__(self, vocabulary: list[str]) -> None:
        self.vocabulary = vocabulary

    def embed(self, text: str) -> list[float]:
        lowered = text.lower()
        return [1.0 if token in lowered else 0.0 for token in self.vocabulary]


def test_bundled_dataset_is_valid_and_evaluator_reports_metrics():
    dataset = Path("tests/data/rag_eval_dataset.json")
    samples = load_dataset(dataset)
    provider = TokenEmbeddingProvider([sample["id"] for sample in samples])
    result = evaluate(samples, provider)
    report = render_report(result, dataset, "test-provider")
    assert result.sample_count >= 50
    assert result.recall_at_5 == 1.0
    assert result.recall_at_10 == 1.0
    assert result.mrr == 1.0
    assert "Recall@5" in report
    assert "Recall@10" in report
    assert "MRR" in report
