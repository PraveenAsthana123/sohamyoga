#!/usr/bin/env bash
set -euo pipefail
echo "Installing Matomo ..."
echo "  $ docker run -p 8080:80 matomo"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
docker run -p 8080:80 matomo
echo "✓ Matomo installed · port 8080"
if [ "MYSQL_HOST · MATOMO_DB_PASSWORD" != "none" ]; then
  echo ""
  echo "Setup required: MYSQL_HOST · MATOMO_DB_PASSWORD"
fi
