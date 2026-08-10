#!/usr/bin/env bash
set -euo pipefail
echo "Installing Dittofeed ..."
echo "  $ docker compose up dittofeed/dittofeed"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
docker compose up dittofeed/dittofeed
echo "✓ Dittofeed installed"
if [ "SMTP + DB" != "none" ]; then
  echo ""
  echo "Setup required: SMTP + DB"
fi
