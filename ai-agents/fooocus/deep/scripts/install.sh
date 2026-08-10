#!/usr/bin/env bash
set -euo pipefail
echo "Installing Fooocus ..."
echo "  $ git clone https://github.com/lllyasviel/Fooocus && cd Fooocus && python launch.py"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
git clone https://github.com/lllyasviel/Fooocus && cd Fooocus && python launch.py
echo "✓ Fooocus installed"
if [ "none" != "none" ]; then
  echo ""
  echo "Setup required: none"
fi
