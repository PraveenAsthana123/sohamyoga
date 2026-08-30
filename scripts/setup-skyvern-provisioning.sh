#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKYVERN_DIR="$PROJECT_ROOT/vendor/skyvern"
OVERRIDE_FILE="$PROJECT_ROOT/infrastructure/skyvern/docker-compose.override.yml"

if [[ ! -f "$SKYVERN_DIR/docker-compose.yml" ]]; then
  "$PROJECT_ROOT/scripts/setup_ai_agent_stack.sh" --tool skyvern
fi

if [[ ! -f "$SKYVERN_DIR/.env" ]]; then
  cp "$SKYVERN_DIR/.env.example" "$SKYVERN_DIR/.env"
fi
if [[ ! -f "$SKYVERN_DIR/skyvern-frontend/.env" ]]; then
  cp "$SKYVERN_DIR/skyvern-frontend/.env.example" "$SKYVERN_DIR/skyvern-frontend/.env"
fi

docker compose -p soham-skyvern \
  -f "$SKYVERN_DIR/docker-compose.yml" \
  -f "$OVERRIDE_FILE" config --quiet

compose=(docker compose -p soham-skyvern -f "$SKYVERN_DIR/docker-compose.yml" -f "$OVERRIDE_FILE")
if ! "${compose[@]}" up -d; then
  # Upstream image 5a3f860 (observed 2026-08-20) can leave this obsolete
  # constraint after its own migrations, then correctly reports that its model
  # expects it removed. Only repair that exact, known fresh-schema mismatch.
  if docker logs soham-skyvern-skyvern-1 2>&1 | grep -q "remove_constraint.*ck_google_oauth_credentials_state"; then
    docker exec soham-skyvern-postgres-1 psql -X -v ON_ERROR_STOP=1 -U skyvern -d skyvern \
      -c "ALTER TABLE google_oauth_credentials DROP CONSTRAINT IF EXISTS ck_google_oauth_credentials_state;"
    "${compose[@]}" up -d
  else
    echo "Skyvern failed to start for an unrecognized reason; inspect docker logs." >&2
    exit 1
  fi
fi

for _attempt in $(seq 1 48); do
  status="$(docker inspect soham-skyvern-skyvern-1 --format '{{.State.Health.Status}}' 2>/dev/null || true)"
  [[ "$status" == "healthy" ]] && break
  [[ "$status" == "unhealthy" ]] && { docker logs --tail 80 soham-skyvern-skyvern-1 >&2; exit 1; }
  sleep 5
done
[[ "${status:-}" == "healthy" ]] || { echo "Skyvern health check timed out." >&2; exit 1; }

# The container creates these bind-mounted files as root on Linux. Return only
# this generated credential directory to the invoking user, then lock it down.
docker exec soham-skyvern-skyvern-1 chown -R "$(id -u):$(id -g)" /app/.skyvern
chmod 700 "$SKYVERN_DIR/.skyvern"
chmod 600 "$SKYVERN_DIR/.skyvern/credentials.toml"

# Copy the generated key into the existing OpenBao KV store when available.
# Neither the key nor the vault response is printed.
CFG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/sohamyoga"
if [[ -f "$CFG_DIR/runtime.env" ]] && command -v jq >/dev/null; then
  set -a; source "$CFG_DIR/runtime.env"; set +a
  skyvern_key="$(sed -n 's/.*cred="\([^"]*\)".*/\1/p' "$SKYVERN_DIR/.skyvern/credentials.toml" | head -1)"
  if [[ -n "$skyvern_key" && -n "${OPENBAO_ADDR:-}" && -n "${OPENBAO_ROOT_TOKEN:-}" ]]; then
    payload="$(jq -cn --arg api_key "$skyvern_key" --arg base_url "http://127.0.0.1:${SOHAM_SKYVERN_API_PORT:-18000}" '{data:{api_key:$api_key,base_url:$base_url}}')"
    curl -fsS --max-time 8 -o /dev/null -X POST -H "X-Vault-Token: $OPENBAO_ROOT_TOKEN" -H 'Content-Type: application/json' \
      --data "$payload" "$OPENBAO_ADDR/v1/secret/data/sohamyoga-portal/skyvern"
    echo "Skyvern API credential stored in OpenBao at secret/sohamyoga-portal/skyvern."
    unset skyvern_key payload
  fi
fi

echo "Skyvern starting: UI http://127.0.0.1:${SOHAM_SKYVERN_UI_PORT:-18080} · API http://127.0.0.1:${SOHAM_SKYVERN_API_PORT:-18000}"
echo "Health: curl http://127.0.0.1:${SOHAM_SKYVERN_API_PORT:-18000}/api/v1/heartbeat"
