#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNNER="$ROOT/scripts/run-platform-quality-gates.sh"
LOG_DIR="$ROOT/jobs/logs/quality-gates"
TMP="$(mktemp)"
mkdir -p "$LOG_DIR"
crontab -l 2>/dev/null | grep -v 'SOHAM-QUALITY-GATE' > "$TMP" || true
{
  echo "*/15 * * * * $RUNNER health >> $LOG_DIR/health.log 2>&1 # SOHAM-QUALITY-GATE"
  echo "0 2 * * * $RUNNER daily >> $LOG_DIR/daily.log 2>&1 # SOHAM-QUALITY-GATE"
  echo "0 3 * * 0 $RUNNER weekly >> $LOG_DIR/weekly.log 2>&1 # SOHAM-QUALITY-GATE"
} >> "$TMP"
crontab "$TMP"
rm "$TMP"
echo "Installed health (15m), daily build/test/UI, and weekly load quality gates."
