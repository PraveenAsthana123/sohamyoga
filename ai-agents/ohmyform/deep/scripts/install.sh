#!/usr/bin/env bash
set -euo pipefail
echo "Installing OhMyForm ..."
echo "  $ docker run -p 5000:5000 ohmyform/ohmyform"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
docker run -p 5000:5000 ohmyform/ohmyform
echo "✓ OhMyForm installed"
if [ "MongoDB" != "none" ]; then
  echo ""
  echo "Setup required: MongoDB"
fi
