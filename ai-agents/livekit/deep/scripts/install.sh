#!/usr/bin/env bash
set -euo pipefail
echo "Installing LiveKit ..."
pip install livekit livekit-agents livekit-plugins-openai
echo "✓ LiveKit installed"
if [ "LIVEKIT_API_KEY · LIVEKIT_API_SECRET" != "none" ]; then
  echo ""
  echo "API key setup required:"
  echo "  LIVEKIT_API_KEY · LIVEKIT_API_SECRET"
  echo "Export the env vars before using."
fi
