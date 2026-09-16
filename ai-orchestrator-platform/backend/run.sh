#!/usr/bin/env bash
# Run the orchestrator FastAPI backend on 127.0.0.1:8100 using UV.
set -euo pipefail
cd "$(dirname "$0")"
set -a
[ -f .env ] && source .env
set +a
exec uv run uvicorn app.main:app --host "${ORCH_BACKEND_HOST:-127.0.0.1}" --port "${ORCH_BACKEND_PORT:-8100}"
