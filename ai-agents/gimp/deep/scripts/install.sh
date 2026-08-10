#!/usr/bin/env bash
set -euo pipefail
echo "Installing GIMP ..."
echo "  $ apt install gimp OR flatpak install org.gimp.GIMP"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
apt install gimp OR flatpak install org.gimp.GIMP
echo "✓ GIMP installed"
if [ "none" != "none" ]; then
  echo ""
  echo "Setup required: none"
fi
