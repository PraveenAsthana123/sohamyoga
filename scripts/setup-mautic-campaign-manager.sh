#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)";STACK="$ROOT/infrastructure/mautic";ENV_FILE="$STACK/.env";CREDS="$STACK/.credentials"
command -v docker >/dev/null||{ echo "Docker is required." >&2;exit 1; };docker compose version >/dev/null
if [[ ! -f "$ENV_FILE" ]];then
 db_password="$(openssl rand -hex 24)";root_password="$(openssl rand -hex 24)";umask 077
 printf '%s\n' "MYSQL_ROOT_PASSWORD=$root_password" "MYSQL_DATABASE=mautic" "MYSQL_USER=mautic" "MYSQL_PASSWORD=$db_password" "MAUTIC_DB_HOST=db" "MAUTIC_DB_PORT=3306" "MAUTIC_DB_DATABASE=mautic" "MAUTIC_DB_USER=mautic" "MAUTIC_DB_PASSWORD=$db_password" "MAUTIC_MESSENGER_DSN_EMAIL=doctrine://default" "MAUTIC_MESSENGER_DSN_HIT=doctrine://default" "DOCKER_MAUTIC_LOAD_TEST_DATA=false" >"$ENV_FILE"
fi
docker compose --env-file "$ENV_FILE" -f "$STACK/docker-compose.yml" up -d
echo "Waiting for Mautic health..."
for _ in $(seq 1 80);do [[ "$(docker inspect -f '{{.State.Health.Status}}' sohamyoga-mautic 2>/dev/null||true)" == healthy ]]&&break;sleep 3;done
[[ "$(docker inspect -f '{{.State.Health.Status}}' sohamyoga-mautic 2>/dev/null||true)" == healthy ]]||{ docker logs --tail 80 sohamyoga-mautic >&2;exit 1; }
if ! docker exec --user www-data --workdir /var/www/html sohamyoga-mautic php bin/console doctrine:query:sql "SELECT id FROM users LIMIT 1" >/dev/null 2>&1;then
 admin_password="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)";admin_email="${MAUTIC_ADMIN_EMAIL:-admin@sohamyoga.local}"
 docker exec --user www-data --workdir /var/www/html sohamyoga-mautic php bin/console mautic:install http://127.0.0.1:18090 --admin_email="$admin_email" --admin_password="$admin_password" --admin_firstname=SohamYoga --admin_lastname=Admin --force
 umask 077;printf 'URL=%s\nEMAIL=%s\nPASSWORD=%s\n' 'http://127.0.0.1:18090' "$admin_email" "$admin_password" >"$CREDS"
fi
echo "Mautic is healthy at http://127.0.0.1:18090"
echo "Initial credentials are stored locally in $CREDS (mode 600)."
