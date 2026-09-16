#!/bin/bash
# Generate Software Bill of Materials (SBOM) for the project
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="${PROJECT_ROOT}/sbom"

mkdir -p "$OUTPUT_DIR"

echo "Generating SBOM for Python dependencies..."
pip install -q cyclonedx-bom 2>/dev/null || true
cyclonedx-py requirements \
  -r "${PROJECT_ROOT}/requirements.txt" \
  -o "${OUTPUT_DIR}/sbom-python.json" \
  --format json

echo "Generating SBOM for Node.js dependencies..."
cd "${PROJECT_ROOT}/web"
npx --yes @cyclonedx/cyclonedx-npm \
  --output-file "${OUTPUT_DIR}/sbom-nodejs.json" \
  --output-format JSON

echo ""
echo "✅ SBOM generation complete:"
echo "  - Python: ${OUTPUT_DIR}/sbom-python.json"
echo "  - Node.js: ${OUTPUT_DIR}/sbom-nodejs.json"
echo ""
echo "These files list all direct and transitive dependencies for:"
echo "  - Supply chain security auditing"
echo "  - Vulnerability scanning"
echo "  - License compliance"
echo "  - Dependency tracking"
