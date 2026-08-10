#!/usr/bin/env bash
set -euo pipefail
echo "Installing Deepgram ..."
pip install deepgram-sdk OR npm @deepgram/sdk
echo "✓ Deepgram installed"
if [ "DEEPGRAM_API_KEY" != "none" ]; then
  echo ""
  echo "API key setup required:"
  echo "  DEEPGRAM_API_KEY"
  echo "Export the env vars before using."
fi
