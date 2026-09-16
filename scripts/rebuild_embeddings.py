"""Rebuild knowledge-base embeddings after changing embedding models."""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import case, or_
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.config import Settings
from app.db import SessionLocal
from app.embeddings import EmbeddingProvider, get_embedding_provider
from app.models import KnowledgeChunk


@dataclass(frozen=True)
class RebuildStats:
    candidates: int
    processed: int
    failed: int = 0


def candidate_query(db: Session, knowledge_base_id: str | None, target_model: str, force: bool):
    query = db.query(KnowledgeChunk)
    if knowledge_base_id:
        query = query.filter(KnowledgeChunk.knowledge_base_id == knowledge_base_id)
    if not force:
        query = query.filter(
            or_(
                KnowledgeChunk.embedding_model.is_(None),
                KnowledgeChunk.embedding_model != target_model,
                KnowledgeChunk.embedding_json.is_(None),
            )
        )
    # Null timestamps are unfinished work and must be resumed first.
    null_first = case((KnowledgeChunk.embedding_generated_at.is_(None), 0), else_=1)
    return query.order_by(null_first, KnowledgeChunk.embedding_generated_at.asc(), KnowledgeChunk.id.asc())


def rebuild_embeddings(
    db: Session,
    provider: EmbeddingProvider,
    target_model: str,
    *,
    knowledge_base_id: str | None = None,
    batch_size: int = 32,
    force: bool = False,
    progress=None,
) -> RebuildStats:
    """Re-embed matching chunks in batches; commits each batch for resumability."""
    if batch_size < 1:
        raise ValueError("batch_size must be at least 1")
    query = candidate_query(db, knowledge_base_id, target_model, force)
    candidates = query.count()
    processed = 0
    failed = 0
    processed_ids: set[str] = set()
    while processed < candidates:
        # Always take the first remaining page: after each commit the updated
        # rows no longer match the candidate filter, so offset would skip work.
        query = candidate_query(db, knowledge_base_id, target_model, force)
        chunks = [chunk for chunk in query.limit(batch_size).all() if chunk.id not in processed_ids]
        if not chunks:
            break
        try:
            vectors = provider.embed_batch([chunk.content for chunk in chunks])
            if len(vectors) != len(chunks):
                raise ValueError("embedding provider returned an unexpected batch size")
            generated_at = datetime.now(UTC)
            for chunk, vector in zip(chunks, vectors, strict=True):
                chunk.embedding_json = vector
                chunk.embedding_vector = vector
                chunk.embedding_model = target_model
                chunk.embedding_generated_at = generated_at
            db.commit()
            processed += len(chunks)
            processed_ids.update(chunk.id for chunk in chunks)
            if progress:
                progress(processed, candidates)
        except Exception:
            db.rollback()
            failed += len(chunks)
            raise
    return RebuildStats(candidates=candidates, processed=processed, failed=failed)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--knowledge-base-id")
    parser.add_argument("--target-model", required=True)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--dry-run", action="store_true", help="report candidates without changing the database")
    parser.add_argument("--force", action="store_true", help="rebuild chunks regardless of recorded model")
    args = parser.parse_args()
    if args.batch_size < 1:
        parser.error("--batch-size must be at least 1")

    with SessionLocal() as db:
        query = candidate_query(db, args.knowledge_base_id, args.target_model, args.force)
        candidates = query.count()
        if args.dry_run:
            print(f"Dry run: {candidates} chunk(s) require rebuilding")
            return 0
        settings = Settings(
            secret_key="embedding-rebuild-only-secret-key-32",
            embedding_provider="sentence_transformers",
            embedding_model=args.target_model,
        )
        provider = get_embedding_provider(settings)
        stats = rebuild_embeddings(
            db,
            provider,
            args.target_model,
            knowledge_base_id=args.knowledge_base_id,
            batch_size=args.batch_size,
            force=args.force,
            progress=lambda done, total: print(f"Rebuilt {done}/{total} chunk(s)"),
        )
    print(f"Completed: {stats.processed} chunk(s) rebuilt")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
