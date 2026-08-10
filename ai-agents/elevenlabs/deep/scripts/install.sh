#!/usr/bin/env bash
set -euo pipefail
echo "Installing ElevenLabs ..."
pip install elevenlabs OR npm elevenlabs
echo "✓ ElevenLabs installed"
if [ "ELEVENLABS_API_KEY" != "none" ]; then
  echo ""
  echo "API key setup required:"
  echo "  ELEVENLABS_API_KEY"
  echo "Export the env vars before using."
fi
