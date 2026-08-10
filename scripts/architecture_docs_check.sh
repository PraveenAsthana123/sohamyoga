#!/usr/bin/env bash
# architecture_docs_check.sh — verify §86 architecture docs are present + current.
# Cron-installable. Writes structured JSON log per run.

set -uo pipefail
PROJECT="${PROJECT_ROOT:-$(pwd)}"
LOG_DIR="$PROJECT/jobs/logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/architecture_docs_check.log"
JSON_LOG="$LOG_DIR/architecture_docs_check.jsonl"
TS=$(date -Iseconds)
STALE_DAYS=30
PROBLEMS=0

DOCS=(
  "README.md"
  "docs/architecture/ARCHITECTURE.md"
  "docs/architecture/FLOW_DIAGRAM.md"
  "docs/architecture/NETWORK_FLOW.md"
  "docs/architecture/SEQUENCE_DIAGRAMS.md"
)

# Use python to do the heavy lifting (more reliable than bash assoc arrays in a heredoc)
python3 - "$TS" "$PROJECT" "$STALE_DAYS" "$LOG" "$JSON_LOG" "${DOCS[@]}" <<'PYEOF'
import json, os, sys, time
ts, project, stale_days, log_path, json_log_path = sys.argv[1:6]
docs = sys.argv[6:]
stale_days = int(stale_days)
problems = 0
results = {}
log_lines = []

for doc in docs:
    path = os.path.join(project, doc)
    if not os.path.isfile(path):
        results[doc] = "missing"
        problems += 1
        log_lines.append(f"[{ts}] MISSING {doc}")
        continue
    age_days = (time.time() - os.path.getmtime(path)) // 86400
    has_mermaid = True
    if doc != "README.md":
        with open(path) as f:
            content = f.read()
        has_mermaid = "```mermaid" in content
    if age_days > stale_days:
        results[doc] = f"stale ({int(age_days)}d)"
        problems += 1
        log_lines.append(f"[{ts}] STALE {doc} ({int(age_days)}d)")
    elif not has_mermaid:
        results[doc] = "no-mermaid"
        problems += 1
        log_lines.append(f"[{ts}] NO-MERMAID {doc}")
    else:
        results[doc] = f"ok ({int(age_days)}d)"

summary = f"[{ts}] ARCH_DOCS_CHECK: {problems} problem(s)" if problems else f"[{ts}] ARCH_DOCS_CHECK: all clear ({len(docs)} docs)"
log_lines.append(summary)
with open(log_path, "a") as f:
    f.write("\n".join(log_lines) + "\n")
with open(json_log_path, "a") as f:
    f.write(json.dumps({"timestamp": ts, "project": project, "problems": problems, "results": results}) + "\n")
sys.exit(1 if problems else 0)
PYEOF
EXIT=$?
exit $EXIT
