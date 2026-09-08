#!/usr/bin/env bash
# Numbered SQL migration runner for voice-agent-platform.
# Applies each domain's db-schema.sql against the dockerized Postgres
# container, tracked idempotently in a schema_migration table so re-running
# this script is always safe. Mirrors the pattern in
# /mnt/deepa/sohamyoga/scripts/migrate-domain-schemas.sh but this project is
# fully self-contained (its own container, its own schema list).
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_CONTAINER="${DB_CONTAINER:-voiceagent-postgres}"
DB_USER="${POSTGRES_USER:-voiceagent}"
DB_NAME="${POSTGRES_DB:-voiceagent}"

# Migration key | path relative to PROJECT_ROOT
migrations=(
  "001-admin|src/domain/admin/db-schema.sql"
  "002-contact|src/domain/contact/db-schema.sql"
  "003-form|src/domain/form/db-schema.sql"
  "004-script|src/domain/script/db-schema.sql"
  "005-call|src/domain/call/db-schema.sql"
  "006-vapi-sync|src/domain/call/db-schema-vapi-sync.sql"
  "007-vapi-sync-log|src/domain/call/db-schema-vapi-sync-log.sql"
  "008-script-direction|src/domain/script/db-schema-direction.sql"
  "009-vapi-advanced-config|src/domain/call/db-schema-vapi-advanced-config.sql"
  "010-yoga-service-type|src/domain/script/db-schema-yoga-service-type.sql"
  "011-business-customer|src/domain/customer/db-schema.sql"
  "012-follow-up-flag|src/domain/call/db-schema-follow-up-flag.sql"
  "013-external-call-id|src/domain/call/db-schema-external-call-id.sql"
  "014-webhook-fields|src/domain/call/db-schema-webhook-fields.sql"
  "015-vapi-api-audit-log|src/domain/call/db-schema-vapi-api-audit-log.sql"
  "016-notification|src/domain/notification/db-schema.sql"
  "017-customer-notes|src/domain/customer/db-schema-notes.sql"
  "018-quality-incident|src/domain/call/db-schema-quality-incident.sql"
  "019-script-category|src/domain/script/db-schema-category.sql"
  "020-cost-cap|src/domain/customer/db-schema-cost-cap.sql"
  "021-script-template|src/domain/script/db-schema-template.sql"
  "022-vapi-created-assistant|src/domain/call/db-schema-vapi-created-assistant.sql"
  "023-customer-preferences|src/domain/contact/db-schema-preferences.sql"
)

psql_cmd=(docker exec -i "$DB_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME")

docker inspect "$DB_CONTAINER" >/dev/null 2>&1 || {
  echo "Database container '$DB_CONTAINER' does not exist. Run: docker compose up -d" >&2
  exit 1
}

# Wait for Postgres to accept connections (container may still be starting).
for _ in $(seq 1 30); do
  if docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

"${psql_cmd[@]}" <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migration (
  migration_key TEXT PRIMARY KEY,
  source_path TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

for entry in "${migrations[@]}"; do
  key="${entry%%|*}"
  relative="${entry#*|}"
  file="$PROJECT_ROOT/$relative"
  [[ -f "$file" ]] || { echo "Missing schema: $relative" >&2; exit 1; }

  applied="$(docker exec "$DB_CONTAINER" psql -X -U "$DB_USER" -d "$DB_NAME" -Atc \
    "SELECT 1 FROM schema_migration WHERE migration_key='${key}'")"
  if [[ "$applied" == "1" ]]; then
    echo "SKIP  $key"
    continue
  fi

  echo "APPLY $key  ($relative)"
  {
    printf 'BEGIN;\n'
    cat "$file"
    printf "\nINSERT INTO schema_migration(migration_key,source_path) VALUES ('%s','%s');\nCOMMIT;\n" "$key" "$relative"
  } | "${psql_cmd[@]}"
done

echo
echo "Applied migrations:"
docker exec "$DB_CONTAINER" psql -X -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT migration_key, applied_at FROM schema_migration ORDER BY migration_key"
