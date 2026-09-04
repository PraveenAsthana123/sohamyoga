#!/usr/bin/env bash
set -uo pipefail

REPO="/mnt/deepa/sohamyoga"
QUEUE="$REPO/.overnight-tasks.md"
LOGDIR="$REPO/.overnight-logs"
LOG="$LOGDIR/$(TZ=America/Edmonton date +%Y-%m-%d).log"
HARD_STOP_HOUR=9
PACE_SECONDS=240

mkdir -p "$LOGDIR"

log() {
  local ts
  ts=$(TZ=America/Edmonton date "+%Y-%m-%d %H:%M:%S %Z")
  echo "[$ts] $1" | tee -a "$LOG"
}

past_hard_stop() {
  local hour
  hour=$(TZ=America/Edmonton date +%H)
  [ "$((10#$hour))" -ge "$HARD_STOP_HOUR" ]
}

log "=== Overnight run started ==="

if [ ! -f "$QUEUE" ]; then
  log "No task queue file at $QUEUE -- nothing to do."
  log "=== Overnight run ended ==="
  exit 0
fi

mapfile -t TASK_LINES < <(grep -n '^- \[ \] READY:' "$QUEUE" || true)

if [ "${#TASK_LINES[@]}" -eq 0 ]; then
  log "No READY tasks in queue -- nothing to do."
  log "=== Overnight run ended ==="
  exit 0
fi

for entry in "${TASK_LINES[@]}"; do
  if past_hard_stop; then
    log "Hard stop (09:00 MST) reached -- stopping before next task."
    break
  fi

  line_no="${entry%%:*}"
  task_text="${entry#*READY: }"

  log "--- Starting task: $task_text ---"

  before_status=$(git -C "$REPO" status --porcelain | sort)

  task_out="$LOGDIR/task-$(date +%s).out"
  prompt="Repo: $REPO. Task: $task_text. Follow the repo's existing conventions (check 2-3 similar existing files first). Build it for real -- no mocks, no fabricated data, no fake success claims. Run a real build/typecheck command and report its actual result. If a module_registry entry is relevant, update it against the live DB. Do not commit or push -- just leave the change in the working tree."

  if claude -p "$prompt" --model claude-sonnet-5 --cwd "$REPO" > "$task_out" 2>&1; then
    log "Build step OK: $task_text (full output: $task_out)"
  else
    log "Build step FAILED: $task_text (see $task_out) -- leaving queue entry as READY for manual review."
    log "--- Finished task (failed): $task_text ---"
    if past_hard_stop; then log "Hard stop reached -- stopping."; break; fi
    log "Pacing ${PACE_SECONDS}s before next task..."
    sleep "$PACE_SECONDS"
    continue
  fi

  after_status=$(git -C "$REPO" status --porcelain | sort)
  new_paths=$(comm -13 <(echo "$before_status") <(echo "$after_status") | cut -c4- | sed 's/ -> .*//')

  if [ -z "$new_paths" ]; then
    log "No new/changed files detected for: $task_text -- marking NO-CHANGE, needs human look."
    sed -i "${line_no}s/READY:/NO-CHANGE:/" "$QUEUE"
    log "--- Finished task: $task_text ---"
    if past_hard_stop; then log "Hard stop reached -- stopping."; break; fi
    log "Pacing ${PACE_SECONDS}s before next task..."
    sleep "$PACE_SECONDS"
    continue
  fi

  log "Files touched by this task:"
  echo "$new_paths" | while IFS= read -r p; do log "  $p"; done

  ( cd "$REPO" && echo "$new_paths" | xargs -d '\n' git add -- )

  commit_msg="chore(overnight): ${task_text}

Automated overnight run, $(TZ=America/Edmonton date '+%Y-%m-%d %H:%M %Z').
"
  if git -C "$REPO" commit -m "$commit_msg" > /dev/null 2>&1; then
    if git -C "$REPO" push origin main >> "$LOG" 2>&1; then
      log "Committed and pushed: $task_text"
      sed -i "${line_no}s/READY:/DONE:/" "$QUEUE"
    else
      log "Push FAILED for: $task_text -- committed locally only, needs manual push."
    fi
  else
    log "Commit FAILED for: $task_text (nothing staged, or pre-commit hook rejected it) -- see $LOG"
  fi

  log "--- Finished task: $task_text ---"

  if past_hard_stop; then
    log "Hard stop reached after task -- stopping."
    break
  fi

  log "Pacing ${PACE_SECONDS}s before next task..."
  sleep "$PACE_SECONDS"
done

log "=== Overnight run ended ==="
