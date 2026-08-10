#!/usr/bin/env bash
set -euo pipefail
echo "Installing Piper TTS ..."
pip install piper-tts
echo "✓ Piper TTS installed"
if [ "none" != "none" ]; then
  echo ""
  echo "API key setup required:"
  echo "  none"
  echo "Export the env vars before using."
fi
