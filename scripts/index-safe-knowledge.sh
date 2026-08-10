#!/usr/bin/env bash
set -euo pipefail
ROOT=/mnt/deepa/sohamyoga
export EMBED_MODEL="${EMBED_MODEL:-bge-m3:latest}"
# Allowlist only: architecture, policies, domain schemas and public configuration.
# Customer, payment, credential, audit payload and secret files are intentionally excluded.
exec "$HOME/.local/bin/oll" index \
  "$ROOT/docs" \
  "$ROOT/slp-frontend/src/config/experience.config.ts" \
  "$ROOT/slp-frontend/src/domain" \
  "$ROOT/agentic-ollama-platform/OLLAMA_GLOBAL_POLICY.md"
