#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
test -d skyvern || git clone https://github.com/Skyvern-AI/skyvern.git
cd skyvern && docker compose up -d
echo "✓ Skyvern ready · curl http://localhost:8000/api/v1/tasks"
