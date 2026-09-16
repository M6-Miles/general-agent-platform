#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d_%H%M%S)"
ARTIFACT_DIR="$ROOT/data/drill-$STAMP"
PG_RESTORE="openclaw-pg-restore-$STAMP"
REDIS_RESTORE="openclaw-redis-restore-$STAMP"
REDIS_VOLUME="openclaw-redis-restore-$STAMP"
mkdir -p "$ARTIFACT_DIR"

cleanup() {
  docker rm -f "$PG_RESTORE" "$REDIS_RESTORE" >/dev/null 2>&1 || true
  docker volume rm "$REDIS_VOLUME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

START="$(date +%s)"
# This drill validates application data. Excluding ACLs keeps it independent
# of optional runtime-only roles such as rls_verifier.
docker compose exec -T postgres pg_dump -U agent -d agent_runtime -Fc --no-acl -f /tmp/openclaw-drill.dump
docker cp agent-postgres-1:/tmp/openclaw-drill.dump "$ARTIFACT_DIR/postgres.dump"
STREAM_ID="$(docker compose exec -T redis redis-cli XADD agent-runtime:drill '*' type backup-drill | tr -d '\r')"
docker compose exec -T redis redis-cli SAVE >/dev/null
docker cp agent-redis-1:/data/dump.rdb "$ARTIFACT_DIR/redis.rdb"

ORIGINAL_AGENTS="$(docker compose exec -T postgres psql -U agent -d agent_runtime -Atc 'SELECT count(*) FROM agents')"
docker run -d --name "$PG_RESTORE" -e POSTGRES_USER=agent -e POSTGRES_PASSWORD=agent -e POSTGRES_DB=agent_runtime pgvector/pgvector:pg16 >/dev/null
until docker exec "$PG_RESTORE" pg_isready -U agent -d agent_runtime >/dev/null 2>&1; do sleep 1; done
docker cp "$ARTIFACT_DIR/postgres.dump" "$PG_RESTORE:/tmp/postgres.dump"
docker exec "$PG_RESTORE" pg_restore -U agent -d agent_runtime --clean --if-exists --exit-on-error /tmp/postgres.dump
RESTORED_AGENTS="$(docker exec "$PG_RESTORE" psql -U agent -d agent_runtime -Atc 'SELECT count(*) FROM agents')"
test "$ORIGINAL_AGENTS" = "$RESTORED_AGENTS"

docker volume create "$REDIS_VOLUME" >/dev/null
docker create --name "$REDIS_RESTORE-seed" -v "$REDIS_VOLUME:/data" redis:7-alpine >/dev/null
docker cp "$ARTIFACT_DIR/redis.rdb" "$REDIS_RESTORE-seed:/data/dump.rdb"
docker rm "$REDIS_RESTORE-seed" >/dev/null
docker run -d --name "$REDIS_RESTORE" -v "$REDIS_VOLUME:/data" redis:7-alpine redis-server --appendonly no >/dev/null
until docker exec "$REDIS_RESTORE" redis-cli ping | grep -q PONG; do sleep 1; done
docker exec "$REDIS_RESTORE" redis-cli XRANGE agent-runtime:drill "$STREAM_ID" "$STREAM_ID" | grep -q backup-drill
docker compose exec -T redis redis-cli XDEL agent-runtime:drill "$STREAM_ID" >/dev/null

END="$(date +%s)"
echo "artifact_dir=$ARTIFACT_DIR"
echo "postgres_agents=$ORIGINAL_AGENTS"
echo "redis_stream_id=$STREAM_ID"
echo "rto_seconds=$((END-START))"
echo "rpo_records=0"
echo "backup-restore-drill-ok"
