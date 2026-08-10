#!/usr/bin/env bash
set -euo pipefail
ROOT=/mnt/deepa/sohamyoga
CFG="${XDG_CONFIG_HOME:-$HOME/.config}/sohamyoga"
PORTS="$CFG/ports.env"
RUNTIME="$CFG/runtime.env"
SOCIAL="$CFG/social-integrations.env"
POSTIZ_ENV="$CFG/postiz-runtime.env"
mkdir -p "$CFG"; chmod 700 "$CFG"; touch "$PORTS" "$RUNTIME" "$SOCIAL"; chmod 600 "$RUNTIME" "$SOCIAL"
ensure_line(){ local file="$1" key="$2" value="$3"; grep -q "^${key}=" "$file" || printf '%s=%s\n' "$key" "$value" >> "$file"; }
ensure_secret(){ local file="$1" key="$2"; grep -q "^${key}=" "$file" || printf '%s=%s\n' "$key" "$(openssl rand -hex 32)" >> "$file"; }
ensure_line "$PORTS" SOHAM_POSTIZ_PORT 15080
ensure_line "$PORTS" SOHAM_POSTIZ_API_PORT 15081
ensure_line "$PORTS" SOHAM_OPENBAO_PORT 18200
set -a; source "$PORTS"; source "$RUNTIME" 2>/dev/null || true; source "$SOCIAL" 2>/dev/null || true; set +a
[[ "${SOHAM_POSTIZ_PORT}" != 3000 && "${SOHAM_POSTIZ_API_PORT}" != 3000 ]] || { echo 'Refusing port 3000: it belongs to another project.' >&2; exit 2; }
umask 077; touch "$POSTIZ_ENV"; chmod 600 "$POSTIZ_ENV"
ensure_line "$POSTIZ_ENV" "POSTIZ_URL" "http://localhost:$SOHAM_POSTIZ_PORT"
ensure_line "$POSTIZ_ENV" "POSTIZ_FRONTEND_URL" "http://localhost:$SOHAM_POSTIZ_PORT"
ensure_secret "$POSTIZ_ENV" POSTIZ_JWT_SECRET
ensure_secret "$POSTIZ_ENV" POSTIZ_SECRET
ensure_secret "$POSTIZ_ENV" POSTGRES_PASSWORD
ensure_secret "$RUNTIME" OPENBAO_ROOT_TOKEN
ensure_line "$RUNTIME" OPENBAO_ADDR "http://127.0.0.1:$SOHAM_OPENBAO_PORT"
ensure_line "$RUNTIME" POSTIZ_CLIENT_URL "http://127.0.0.1:$SOHAM_POSTIZ_PORT"
ensure_line "$RUNTIME" POSTIZ_INTERNAL_URL "http://127.0.0.1:$SOHAM_POSTIZ_PORT"
chmod 600 "$POSTIZ_ENV" "$RUNTIME"
set -a; source "$RUNTIME"; source "$POSTIZ_ENV"; source "$SOCIAL" 2>/dev/null || true; set +a
docker network inspect sohamyoga-net >/dev/null 2>&1 || docker network create sohamyoga-net >/dev/null
docker compose --env-file "$RUNTIME" --env-file "$PORTS" -f "$ROOT/sohamyoga-frontend/downloads/docker/openbao/docker-compose.openbao.yml" up -d openbao
for i in $(seq 1 30); do curl -fsS --max-time 2 "$OPENBAO_ADDR/v1/sys/health" >/dev/null && break; sleep 1; done
curl -fsS --max-time 3 "$OPENBAO_ADDR/v1/sys/health" >/dev/null || { echo 'OpenBao failed health check' >&2; exit 1; }
docker compose --env-file "$POSTIZ_ENV" --env-file "$SOCIAL" --env-file "$PORTS" -f "$ROOT/integrations/postiz/docker-compose.yml" up -d
for i in $(seq 1 90); do code=$(curl -sS -o /dev/null --max-time 3 -w '%{http_code}' "http://127.0.0.1:$SOHAM_POSTIZ_PORT/" 2>/dev/null || true); [[ "$code" =~ ^(2|3) ]] && break; sleep 2; done
echo "Postiz HTTP: ${code:-000} at http://127.0.0.1:$SOHAM_POSTIZ_PORT"
echo "OpenBao: healthy at http://127.0.0.1:$SOHAM_OPENBAO_PORT"
echo 'Secrets are stored in protected runtime files and were not printed.'
