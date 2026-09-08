#!/usr/bin/env bash
# Real external health monitor -- TD-07, named throughout the 2026-09-08
# engineering audit as the single highest-leverage fix: every real incident
# found this session (dead backend, broken build, stale nginx DNS, stopped
# container) was invisible to every existing system because nothing checked
# "is the service actually working," only "is the process alive."
#
# Checks real HTTP endpoints, not just `docker ps`/`systemctl is-active`.
# Logs every run; on any failure, appends to a separate alert log that's
# easy to grep/tail without wading through healthy-run noise.
set -uo pipefail

LOG_DIR="/mnt/deepa/sohamyoga/.health-logs"
LOG_FILE="$LOG_DIR/health-$(date -u +%Y-%m-%d).log"
ALERT_FILE="$LOG_DIR/alerts.log"
mkdir -p "$LOG_DIR"

TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
FAIL_COUNT=0

check() {
  local name="$1" url="$2" expect="${3:-200}"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 8 "$url" 2>/dev/null || echo "000")
  if [ "$code" = "$expect" ]; then
    echo "$TS OK   $name ($url) -> $code" >> "$LOG_FILE"
  else
    echo "$TS FAIL $name ($url) -> $code (expected $expect)" >> "$LOG_FILE"
    echo "$TS FAIL $name ($url) -> $code (expected $expect)" >> "$ALERT_FILE"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# Portals (real health/liveness endpoints found during this audit)
check "sohamyoga-frontend (direct)"       http://127.0.0.1:3110/api/health
check "sohamyoga-frontend (via nginx)"    http://127.0.0.1:8085/api/health
check "SohamYoga.Web backend"             http://127.0.0.1:5070/api/health
check "market-research-portal"            http://127.0.0.1:8086/login
check "voice-agent-platform"              http://127.0.0.1:8090/api/health
check "ai-orchestrator-platform backend"  http://127.0.0.1:8100/auth/status
check "ai-orchestrator-platform frontend" http://127.0.0.1:8101/

# AI gateways / model layer
check "LiteLLM gateway"        http://127.0.0.1:4400/health/liveliness
check "OmniRoute gateway"      http://127.0.0.1:20128/api/health
check "Ollama (11434, legacy)" http://127.0.0.1:11434/api/tags
check "Ollama (11435, main)"   http://127.0.0.1:11435/api/tags
check "ContextForge"           http://127.0.0.1:4444/health

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "$TS SUMMARY: $FAIL_COUNT service(s) failing -- see $ALERT_FILE" >> "$LOG_FILE"
fi

find "$LOG_DIR" -name 'health-*.log' -mtime +14 -delete

exit 0
