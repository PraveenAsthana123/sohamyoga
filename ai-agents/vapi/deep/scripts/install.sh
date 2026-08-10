#!/usr/bin/env bash
set -euo pipefail
echo "Installing Vapi ..."
pip install vapi_python OR npm @vapi-ai/web
echo "✓ Vapi installed"
if [ "VAPI_API_KEY" != "none" ]; then
  echo ""
  echo "API key setup required:"
  echo "  VAPI_API_KEY"
  echo "Export the env vars before using."
fi
