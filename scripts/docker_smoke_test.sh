#!/usr/bin/env sh
set -eu

IMAGE_NAME=${IMAGE_NAME:-agent-platform:test}
CONTAINER_NAME=${CONTAINER_NAME:-agent-platform-smoke}

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run -d --name "$CONTAINER_NAME" \
  -e SECRET_KEY=smoke-test-secret-key-32-characters "$IMAGE_NAME" >/dev/null

for attempt in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" python -c \
    "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)" \
    >/dev/null 2>&1; then
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    docker logs "$CONTAINER_NAME"
    exit 1
  fi
  sleep 1
done

docker exec "$CONTAINER_NAME" python -c \
  "import openpyxl, yaml, sentence_transformers; print('Dependencies OK')"
docker exec "$CONTAINER_NAME" python -c \
  "from app.embeddings import get_embedding_provider; from app.config import Settings; s=Settings(secret_key='smoke-test-secret-key-32-characters', embedding_provider='mock'); print('Embedding OK', len(get_embedding_provider(s).embed('smoke')))"
