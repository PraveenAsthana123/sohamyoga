#!/usr/bin/env bash
set -euo pipefail
echo "Installing Mautic ..."
echo "  $ docker run -p 8080:80 mautic/mautic"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
docker run -p 8080:80 mautic/mautic
echo "✓ Mautic installed"
if [ "DB + SMTP" != "none" ]; then
  echo ""
  echo "Setup required: DB + SMTP"
fi
