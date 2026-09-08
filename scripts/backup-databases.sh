#!/usr/bin/env bash
# Recurring backup for the workspace's live-data Postgres databases.
# Added 2026-09-08 (engineering audit, TD-04/DB-05): a one-time backup was
# taken during the audit but nothing scheduled a repeat. This closes that
# gap for real. Keeps the last 14 daily backups per database, deletes older
# ones -- bounded disk usage, no manual cleanup needed.
set -euo pipefail

BACKUP_DIR="/mnt/deepa/sohamyoga/.backups"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
RETAIN_DAYS=14

mkdir -p "$BACKUP_DIR"

backup_db() {
  local container="$1" user="$2" db="$3" label="$4"
  local out="$BACKUP_DIR/${label}_${STAMP}.dump"
  if ! docker ps --format '{{.Names}}' | grep -qx "$container"; then
    echo "[backup] SKIP $label: container $container is not running"
    return 0
  fi
  if docker exec -u postgres "$container" pg_dump -U "$user" -d "$db" -Fc -f "/tmp/${label}_${STAMP}.dump"; then
    docker cp "$container:/tmp/${label}_${STAMP}.dump" "$out"
    docker exec "$container" rm -f "/tmp/${label}_${STAMP}.dump"
    echo "[backup] OK $label -> $out ($(du -h "$out" | cut -f1))"
  else
    echo "[backup] FAILED $label" >&2
  fi
}

backup_db sohamyoga-postgres sohamyoga sohamyoga sohamyoga
backup_db sohamyoga-postgres sohamyoga market_research_portal market_research_portal
backup_db voiceagent-postgres "$(docker exec voiceagent-postgres env | grep POSTGRES_USER | cut -d= -f2)" "$(docker exec voiceagent-postgres env | grep POSTGRES_DB | cut -d= -f2)" voiceagent

find "$BACKUP_DIR" -name '*.dump' -mtime "+${RETAIN_DAYS}" -print -delete
