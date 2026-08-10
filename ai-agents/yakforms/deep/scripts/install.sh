#!/usr/bin/env bash
set -euo pipefail
echo "Installing YakForms ..."
echo "  $ git clone https://framagit.org/yakforms/yakforms && docker compose up"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
git clone https://framagit.org/yakforms/yakforms && docker compose up
echo "✓ YakForms installed"
if [ "DB creds" != "none" ]; then
  echo ""
  echo "Setup required: DB creds"
fi
