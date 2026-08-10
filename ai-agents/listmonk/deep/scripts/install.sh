#!/usr/bin/env bash
set -euo pipefail
echo "Installing Listmonk ..."
echo "  $ docker run -p 9000:9000 listmonk/listmonk"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
docker run -p 9000:9000 listmonk/listmonk
echo "✓ Listmonk installed"
if [ "SMTP creds" != "none" ]; then
  echo ""
  echo "Setup required: SMTP creds"
fi
