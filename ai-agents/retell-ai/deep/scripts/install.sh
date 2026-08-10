#!/usr/bin/env bash
set -euo pipefail
echo "Installing Retell AI ..."
pip install retell-sdk
echo "✓ Retell AI installed"
if [ "RETELL_API_KEY" != "none" ]; then
  echo ""
  echo "API key setup required:"
  echo "  RETELL_API_KEY"
  echo "Export the env vars before using."
fi
