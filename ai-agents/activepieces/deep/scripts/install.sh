#!/usr/bin/env bash
set -euo pipefail
echo "Installing Activepieces ..."
echo "  $ docker run -p 8080:80 activepieces/activepieces"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
docker run -p 8080:80 activepieces/activepieces
echo "✓ Activepieces installed · port 8080"
if [ "AP_API_KEY" != "none" ]; then
  echo ""
  echo "Setup required: AP_API_KEY"
fi
