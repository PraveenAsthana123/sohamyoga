#!/usr/bin/env bash
set -euo pipefail
echo "Installing Cartesia (Sonic) ..."
pip install cartesia OR npm @cartesia/cartesia-js
echo "✓ Cartesia (Sonic) installed"
if [ "CARTESIA_API_KEY" != "none" ]; then
  echo ""
  echo "API key setup required:"
  echo "  CARTESIA_API_KEY"
  echo "Export the env vars before using."
fi
