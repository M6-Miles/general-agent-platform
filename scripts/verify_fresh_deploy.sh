#!/usr/bin/env bash
set -euo pipefail
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-agent-runtime-fresh-verify}"
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BASE_DIR"
docker compose -p "$PROJECT_NAME" down -v --remove-orphans
docker compose -p "$PROJECT_NAME" build --no-cache
docker compose -p "$PROJECT_NAME" up -d
trap 'docker compose -p "$PROJECT_NAME" down -v --remove-orphans' EXIT
for _ in $(seq 1 60); do
  if curl --fail --silent http://localhost:8000/health >/dev/null; then break; fi
  sleep 2
done
curl --fail --silent http://localhost:8000/health
docker compose -p "$PROJECT_NAME" logs migrate | grep -q "Running upgrade"
docker compose -p "$PROJECT_NAME" exec -T api python -c "from app.db import SessionLocal; from sqlalchemy import text; print(SessionLocal().execute(text('SELECT COUNT(*) FROM tenants')).scalar())"
echo "fresh-deploy-verification-ok"
