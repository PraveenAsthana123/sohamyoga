#!/usr/bin/env bash
set -euo pipefail
echo "Installing Postal ..."
echo "  $ docker compose up postalserver/postal"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
docker compose up postalserver/postal
echo "✓ Postal installed"
if [ "admin email" != "none" ]; then
  echo ""
  echo "Setup required: admin email"
fi
