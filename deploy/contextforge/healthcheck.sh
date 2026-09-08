#!/usr/bin/env bash
set -euo pipefail
base_url="${CONTEXTFORGE_URL:-http://127.0.0.1:4444}"
status="$(curl --max-time 15 -sS -o /tmp/soham-contextforge-health.json -w '%{http_code}' "$base_url/health")"
test "$status" = "200"
printf 'ContextForge health: HTTP %s\n' "$status"
status="$(curl --max-time 15 -sS -o /dev/null -w '%{http_code}' "$base_url/v1/gateways")"
test "$status" = "401"
printf 'Unauthenticated gateway registry: HTTP %s (correctly protected)\n' "$status"
