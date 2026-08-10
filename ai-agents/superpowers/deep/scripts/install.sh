#!/usr/bin/env bash
set -euo pipefail
echo "Installing Anthropic Superpowers ..."
echo "  $ /plugin marketplace add claude-code/anthropic-superpowers + per-skill installation"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
/plugin marketplace add claude-code/anthropic-superpowers + per-skill installation
echo "✓ Anthropic Superpowers ready"
if [ "ANTHROPIC_API_KEY" != "none" ]; then
  echo ""
  echo "Setup required: ANTHROPIC_API_KEY"
fi
