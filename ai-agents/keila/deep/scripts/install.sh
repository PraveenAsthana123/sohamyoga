#!/usr/bin/env bash
set -euo pipefail
echo "Installing Keila ..."
echo "  $ docker run -p 4000:4000 ghcr.io/keila/keila"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
docker run -p 4000:4000 ghcr.io/keila/keila
echo "✓ Keila installed"
if [ "SMTP creds" != "none" ]; then
  echo ""
  echo "Setup required: SMTP creds"
fi
