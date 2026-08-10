#!/usr/bin/env bash
set -euo pipefail
echo "Installing Spec-Kit ..."
echo "  $ npm install -g @github/spec-kit OR pip install spec-kit"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
npm install -g @github/spec-kit OR pip install spec-kit
echo "✓ Spec-Kit ready"
if [ "GITHUB_TOKEN (optional)" != "none" ]; then
  echo ""
  echo "Setup required: GITHUB_TOKEN (optional)"
fi
