#!/usr/bin/env bash
# Start LangFlow visual flow builder at http://127.0.0.1:7860
# Install first: uv add langflow (in the optional extras group)
set -euo pipefail
cd "$(dirname "$0")/.."

# Ensure langflow is installed
if ! uv run python -c "import langflow" 2>/dev/null; then
    echo "LangFlow not installed. Installing..."
    uv add langflow>=1.0.0
fi

echo "Starting LangFlow at http://127.0.0.1:7860 ..."
uv run langflow run --host 127.0.0.1 --port 7860
