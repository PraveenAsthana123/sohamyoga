#!/usr/bin/env bash
set -euo pipefail
echo "Installing Pipecat ..."
pip install pipecat-ai[daily,openai,silero]
echo "✓ Pipecat installed"
if [ "OPENAI_API_KEY · DAILY_TOKEN" != "none" ]; then
  echo ""
  echo "API key setup required:"
  echo "  OPENAI_API_KEY · DAILY_TOKEN"
  echo "Export the env vars before using."
fi
