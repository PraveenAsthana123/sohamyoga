#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
stack_dir="$repo_root/sohamyoga-frontend/downloads/docker/activepieces"
env_file="$stack_dir/.env"
compose_file="$stack_dir/docker-compose.activepieces.yml"

if ! docker network inspect sohamyoga-net >/dev/null 2>&1; then
  docker network create sohamyoga-net >/dev/null
fi

if [[ ! -f "$env_file" ]]; then
  umask 077
  db_password=$(openssl rand -hex 24)
  redis_password=$(openssl rand -hex 24)
  encryption_key=$(openssl rand -hex 16)
  jwt_secret=$(openssl rand -hex 32)
  {
    printf 'ACTIVEPIECES_DB_PASSWORD=%s\n' "$db_password"
    printf 'ACTIVEPIECES_REDIS_PASSWORD=%s\n' "$redis_password"
    printf 'ACTIVEPIECES_ENCRYPTION_KEY=%s\n' "$encryption_key"
    printf 'ACTIVEPIECES_JWT_SECRET=%s\n' "$jwt_secret"
    printf 'ACTIVEPIECES_URL=http://127.0.0.1:18181\n'
  } > "$env_file"
fi

chmod 600 "$env_file"
docker compose --env-file "$env_file" -f "$compose_file" config --quiet
docker compose --env-file "$env_file" -f "$compose_file" up -d

printf 'Activepieces started on http://127.0.0.1:18181\n'
printf 'Public webhooks remain disabled until ACTIVEPIECES_URL is a stable HTTPS origin.\n'
