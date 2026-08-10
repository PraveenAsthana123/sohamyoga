#!/usr/bin/env bash
set -euo pipefail
echo "Installing GSD (Goal-Spec-Driven) ..."
echo "  $ pip install gsd-cli OR git clone https://github.com/specdriven/gsd"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
pip install gsd-cli OR git clone https://github.com/specdriven/gsd
echo "✓ GSD (Goal-Spec-Driven) ready"
if [ "none" != "none" ]; then
  echo ""
  echo "Setup required: none"
fi
