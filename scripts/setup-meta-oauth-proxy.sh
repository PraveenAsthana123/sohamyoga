#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="$ROOT/infrastructure/meta-oauth-proxy/docker-compose.yml"
PORT="${SOHAM_META_PROXY_PORT:-18443}"
docker compose -f "$COMPOSE" config --quiet
docker compose -f "$COMPOSE" up -d
for _attempt in $(seq 1 20); do
  code="$(curl -sS -o /dev/null --max-time 2 -w '%{http_code}' "http://127.0.0.1:$PORT/proxy-health" 2>/dev/null || true)"
  [[ "$code" == 200 ]] && break
  sleep 1
done
[[ "${code:-}" == 200 ]] || { docker logs --tail 80 sohamyoga-meta-oauth-proxy >&2; exit 1; }
echo "Restricted Meta OAuth proxy healthy on http://127.0.0.1:$PORT"
