#!/usr/bin/env bash
set -euo pipefail
echo "Installing SendPortal ..."
echo "  $ composer create-project sendportal/sendportal"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
composer create-project sendportal/sendportal
echo "✓ SendPortal installed"
if [ "SES creds" != "none" ]; then
  echo ""
  echo "Setup required: SES creds"
fi
