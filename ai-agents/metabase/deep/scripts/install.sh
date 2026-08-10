#!/usr/bin/env bash
set -euo pipefail
echo "Installing Metabase ..."
echo "  $ docker run -p 3000:3000 metabase/metabase"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
docker run -p 3000:3000 metabase/metabase
echo "✓ Metabase installed · port 3000"
if [ "MB_DB_TYPE · MB_DB_HOST" != "none" ]; then
  echo ""
  echo "Setup required: MB_DB_TYPE · MB_DB_HOST"
fi
