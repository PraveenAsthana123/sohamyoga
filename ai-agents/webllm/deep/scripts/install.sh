#!/usr/bin/env bash
# WebLLM · in-browser LLM via WebGPU
# Per §91 core stack. Frontend-only · npm package.

set -euo pipefail
echo "Installing @mlc-ai/web-llm (frontend) ..."
echo "  $ npm install --save @mlc-ai/web-llm  (in frontend/)"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
FRONTEND_DIR="$(cd "$(dirname "$0")/../../../.." && pwd)/frontend"
test -d "$FRONTEND_DIR" || { echo "  ✗ frontend/ not found"; exit 1; }
cd "$FRONTEND_DIR" && npm install --save @mlc-ai/web-llm
echo "✓ @mlc-ai/web-llm installed (~50 MB)"
echo "  Verify: ls node_modules/@mlc-ai/web-llm"
