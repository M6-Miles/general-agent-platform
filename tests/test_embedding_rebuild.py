from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

from scripts.rebuild_embeddings import RebuildStats, candidate_query, rebuild_embeddings


class FakeQuery:
    def __init__(self, chunks, db=None):
        self.chunks = chunks
        self.db = db

    def filter(self, *_args):
        return self

    def order_by(self, *_args):
        return self

    def count(self):
        return len(self.chunks)

    def offset(self, value):
        return FakeQuery(self.chunks[value:], self.db)

    def limit(self, value):
        return FakeQuery(self.chunks[:value], self.db)

    def all(self):
        if self.db is None:
            return self.chunks
        start = self.db.cursor
        result = self.db.chunks[start : start + self.db.batch_size]
        self.db.cursor += len(result)
        return result


class FakeDb:
    def __init__(self, chunks):
        self.chunks = chunks
        self.commits = 0
        self.cursor = 0
        self.batch_size = 1

    def query(self, _model):
        return FakeQuery(self.chunks, self)

    def commit(self):
        self.commits += 1

    def rollback(self):
        raise AssertionError("rollback was not expected")


class FakeProvider:
    def embed_batch(self, texts):
        return [[float(len(text))] for text in texts]


def test_rebuild_updates_vectors_metadata_and_commits_batches():
    chunks = [SimpleNamespace(id="1", content="one", embedding_json=[], embedding_vector=None, embedding_model="old", embedding_generated_at=None), SimpleNamespace(id="2", content="two", embedding_json=[], embedding_vector=None, embedding_model="old", embedding_generated_at=None)]
    db = FakeDb(chunks)
    db.batch_size = 1
    stats = rebuild_embeddings(db, FakeProvider(), "new", batch_size=1)
    assert stats == RebuildStats(candidates=2, processed=2, failed=0)
    assert db.commits == 2
    assert all(chunk.embedding_model == "new" for chunk in chunks)
    assert all(chunk.embedding_generated_at.tzinfo == UTC for chunk in chunks)
    assert [chunk.embedding_json for chunk in chunks] == [[3.0], [3.0]]


def test_force_flag_includes_current_model_and_query_is_scoped():
    now = datetime.now(UTC) - timedelta(days=1)
    chunks = [SimpleNamespace(id="1", content="x", embedding_json=[1.0], embedding_vector=[1.0], embedding_model="target", embedding_generated_at=now)]
    db = FakeDb(chunks)
    query = candidate_query(db, "kb-1", "target", force=True)
    assert query.count() == 1
    stats = rebuild_embeddings(db, FakeProvider(), "target", knowledge_base_id="kb-1", force=True)
    assert stats.processed == 1
