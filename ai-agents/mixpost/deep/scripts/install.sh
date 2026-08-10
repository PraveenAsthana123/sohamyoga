#!/usr/bin/env bash
set -euo pipefail
echo "Installing Mixpost ..."
echo "  $ docker run -p 8080:80 inovector/mixpost"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
docker run -p 8080:80 inovector/mixpost
echo "✓ Mixpost installed · port 8080"
if [ "DB + social-platform OAuth" != "none" ]; then
  echo ""
  echo "Setup required: DB + social-platform OAuth"
fi
