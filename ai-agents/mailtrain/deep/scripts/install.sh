#!/usr/bin/env bash
set -euo pipefail
echo "Installing Mailtrain ..."
echo "  $ docker run -p 3000:3000 mailtrain/mailtrain"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
docker run -p 3000:3000 mailtrain/mailtrain
echo "✓ Mailtrain installed"
if [ "SES creds" != "none" ]; then
  echo ""
  echo "Setup required: SES creds"
fi
