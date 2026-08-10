#!/usr/bin/env bash
set -euo pipefail
echo "Installing OpenSpec ..."
echo "  $ pip install openspec OR npm install -g openspec"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
pip install openspec OR npm install -g openspec
echo "✓ OpenSpec ready"
if [ "none" != "none" ]; then
  echo ""
  echo "Setup required: none"
fi
