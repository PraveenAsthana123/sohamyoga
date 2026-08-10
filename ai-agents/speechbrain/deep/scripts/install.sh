#!/usr/bin/env bash
set -euo pipefail
echo "Installing SpeechBrain ..."
pip install speechbrain
echo "✓ SpeechBrain installed"
if [ "none" != "none" ]; then
  echo ""
  echo "API key setup required:"
  echo "  none"
  echo "Export the env vars before using."
fi
