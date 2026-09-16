#!/bin/bash
# Complete load testing execution script
# Runs all performance test scenarios and generates reports

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BASE_URL="${BASE_URL:-http://localhost:8000}"
RESULTS_DIR="${PROJECT_ROOT}/load-test-results-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$RESULTS_DIR"

echo "=========================================="
echo "Load Testing Execution"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo "Results: $RESULTS_DIR"
echo ""

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo "❌ k6 is not installed. Please install it first:"
    echo "   Windows: choco install k6"
    echo "   Linux/macOS: brew install k6"
    echo "   Docker: docker pull grafana/k6"
    exit 1
fi

# Check if service is ready
echo "Checking service availability..."
if ! curl -f -s "$BASE_URL/health" > /dev/null; then
    echo "❌ Service is not available at $BASE_URL"
    echo "Please start the service first:"
    echo "   docker-compose up -d"
    exit 1
fi
echo "✅ Service is ready"
echo ""

# Stage 1: Smoke Test
echo "=== Stage 1: Smoke Test ==="
echo "VUs: 1, Duration: 1m"
k6 run --vus 1 --duration 1m \
  --env BASE_URL="$BASE_URL" \
  --out json="$RESULTS_DIR/smoke.json" \
  --summary-export="$RESULTS_DIR/smoke-summary.json" \
  "${PROJECT_ROOT}/tests/performance/api_load.js"
echo ""

# Stage 2: Load Test
echo "=== Stage 2: Load Test ==="
echo "VUs: 50, Duration: 5m"
k6 run --vus 50 --duration 5m \
  --env BASE_URL="$BASE_URL" \
  --out json="$RESULTS_DIR/load.json" \
  --summary-export="$RESULTS_DIR/load-summary.json" \
  "${PROJECT_ROOT}/tests/performance/api_load.js"
echo ""

# Stage 3: Stress Test
echo "=== Stage 3: Stress Test ==="
echo "Stages: 5m:100, 10m:200, 5m:300, 10m:400, 5m:100, 5m:0"
k6 run --stages "5m:100,10m:200,5m:300,10m:400,5m:100,5m:0" \
  --env BASE_URL="$BASE_URL" \
  --out json="$RESULTS_DIR/stress.json" \
  --summary-export="$RESULTS_DIR/stress-summary.json" \
  "${PROJECT_ROOT}/tests/performance/api_load.js"
echo ""

# Stage 4: WebSocket Test (if file exists)
if [ -f "${PROJECT_ROOT}/tests/performance/websocket_load.js" ]; then
    echo "=== Stage 4: WebSocket Test ==="
    echo "VUs: 50, Duration: 3m"
    k6 run --vus 50 --duration 3m \
      --env BASE_URL="$BASE_URL" \
      --out json="$RESULTS_DIR/websocket.json" \
      --summary-export="$RESULTS_DIR/websocket-summary.json" \
      "${PROJECT_ROOT}/tests/performance/websocket_load.js"
    echo ""
fi

# Stage 5: Workflow Test (if file exists)
if [ -f "${PROJECT_ROOT}/tests/performance/workflow_load.js" ]; then
    echo "=== Stage 5: Workflow Test ==="
    echo "VUs: 20, Duration: 5m"
    k6 run --vus 20 --duration 5m \
      --env BASE_URL="$BASE_URL" \
      --out json="$RESULTS_DIR/workflow.json" \
      --summary-export="$RESULTS_DIR/workflow-summary.json" \
      "${PROJECT_ROOT}/tests/performance/workflow_load.js"
    echo ""
fi

echo "=========================================="
echo "✅ Load Testing Complete"
echo "=========================================="
echo "Results saved to: $RESULTS_DIR"
echo ""
echo "Summary files:"
ls -lh "$RESULTS_DIR"/*-summary.json
echo ""
echo "To analyze results:"
echo "  cat $RESULTS_DIR/load-summary.json | jq '.metrics'"
