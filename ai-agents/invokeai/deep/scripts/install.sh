#!/usr/bin/env bash
set -euo pipefail
echo "Installing InvokeAI ..."
echo "  $ pip install InvokeAI --use-pep517 && invokeai-configure"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
pip install InvokeAI --use-pep517 && invokeai-configure
echo "✓ InvokeAI installed"
if [ "none" != "none" ]; then
  echo ""
  echo "Setup required: none"
fi
