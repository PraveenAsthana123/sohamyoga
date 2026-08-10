#!/usr/bin/env bash
set -euo pipefail
echo "Installing Formbricks ..."
echo "  $ docker compose up -d (formbricks/formbricks compose)"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
docker compose up -d (formbricks/formbricks compose)
echo "✓ Formbricks installed"
if [ "none" != "none" ]; then
  echo ""
  echo "Setup required: none"
fi
