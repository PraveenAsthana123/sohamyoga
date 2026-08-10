#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="$PROJECT_ROOT/sohamyoga-frontend"
MODE="${1:-health}"
BASE_URL="${SOHAM_BASE_URL:-http://127.0.0.1:8085}"

check_health() {
  docker exec sohamyoga-postgres pg_isready -U sohamyoga -d sohamyoga
  curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8091/health
  curl --fail --silent --show-error --max-time 10 http://127.0.0.1:11434/api/tags >/dev/null
  docker logs --since 20m sohamyoga-cron 2>&1 | grep -E "failed:|ERROR" && return 1 || true
}

check_ui() {
  local routes=(/ /admin /admin/operations-center /admin/marketing-command /admin/social/setup /admin/health)
  for route in "${routes[@]}"; do
    curl --fail --silent --show-error --max-time 20 "$BASE_URL$route" >/dev/null
  done
}

case "$MODE" in
  health)
    check_health
    ;;
  daily)
    check_health
    check_ui
    (cd "$FRONTEND" && npm test -- --runInBand)
    (cd "$FRONTEND" && npm run build)
    ;;
  weekly)
    check_health
    check_ui
    k6 run --quiet - <<'K6'
import http from 'k6/http';
import { check } from 'k6';
export const options={vus:10,duration:'30s',thresholds:{http_req_failed:['rate<0.01'],http_req_duration:['p(95)<1500']}};
const routes=['/','/admin/operations-center','/admin/marketing-command','/api/ai/health'];
export default function(){const r=http.get((__ENV.SOHAM_BASE_URL||'http://127.0.0.1:8085')+routes[__ITER%routes.length]);check(r,{'HTTP 200':x=>x.status===200});}
K6
    ;;
  *) echo "usage: $0 health|daily|weekly" >&2; exit 2 ;;
esac
