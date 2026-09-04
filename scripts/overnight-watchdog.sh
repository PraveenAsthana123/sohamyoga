#!/usr/bin/env bash
set -uo pipefail

REPO="/mnt/deepa/sohamyoga"
LOGDIR="$REPO/.overnight-logs"
ALERT_FILE="$LOGDIR/WATCHDOG_ALERT.txt"
TODAY_LOG="$LOGDIR/$(TZ=America/Edmonton date +%Y-%m-%d).log"

ts() { TZ=America/Edmonton date "+%Y-%m-%d %H:%M:%S %Z"; }

alert() {
  local msg="$1"
  echo "[$(ts)] WATCHDOG ALERT: $msg" | tee -a "$ALERT_FILE"
  command -v notify-send >/dev/null 2>&1 && \
    DISPLAY="${DISPLAY:-:0}" notify-send -u critical "Overnight run problem" "$msg" 2>/dev/null || true
}

mkdir -p "$LOGDIR"

if [ ! -f "$TODAY_LOG" ]; then
  alert "No log file for today at all -- the overnight timer likely never fired. Check: systemctl --user status sohamyoga-overnight.timer"
  exit 1
fi

if ! grep -q "=== Overnight run started ===" "$TODAY_LOG"; then
  alert "Log file exists but has no start marker -- unexpected. Check $TODAY_LOG"
  exit 1
fi

if ! grep -q "=== Overnight run ended ===" "$TODAY_LOG"; then
  alert "Run started but never reached a clean end marker -- it may have crashed or hung. Check $TODAY_LOG"
  exit 1
fi

fail_count=$(grep -c "FAILED" "$TODAY_LOG" || true)
if [ "$fail_count" -gt 0 ]; then
  alert "Run completed but $fail_count task(s) failed (build error or push failure) -- review $TODAY_LOG"
  exit 0
fi

echo "[$(ts)] Watchdog: last night's run completed cleanly, no failures." | tee -a "$LOGDIR/watchdog.log"
