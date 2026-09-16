#!/usr/bin/env sh
set -eu
cleanup() { docker compose down; }
trap cleanup EXIT
docker compose up -d postgres
docker compose run --rm migrate
docker compose exec -T postgres psql -U agent -d agent_runtime -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN CREATE ROLE rls_verifier LOGIN PASSWORD 'rls_verifier'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT CONNECT ON DATABASE agent_runtime TO rls_verifier;
GRANT USAGE ON SCHEMA public TO rls_verifier;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO rls_verifier;
SQL
RUN_POSTGRES_RLS_TESTS=1 pytest tests/test_rls_runtime.py -v
