#!/usr/bin/env bash
set -euo pipefail
echo "Installing Coqui TTS ..."
pip install TTS
echo "✓ Coqui TTS installed"
if [ "none" != "none" ]; then
  echo ""
  echo "API key setup required:"
  echo "  none"
  echo "Export the env vars before using."
fi
