#!/usr/bin/env bash
set -euo pipefail
echo "Installing BMAD (Build-Measure-Analyze-Deploy) ..."
echo "  $ see _bmad/ for reference impl"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
see _bmad/ for reference impl
echo "✓ BMAD (Build-Measure-Analyze-Deploy) ready"
if [ "see _bmad/scripts/" != "none" ]; then
  echo ""
  echo "Setup required: see _bmad/scripts/"
fi
