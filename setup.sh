#!/usr/bin/env bash
# setup.sh — consolidated entry point for the entire AI agent + use-case stack.
#
# Wraps every other script in this repo into one interactive menu:
#   • install AI agent tools (48 in ai-agents/)
#   • generate per-use-case stub directories (48 §90 + 75 RAF = 123)
#   • download Kaggle datasets for training
#   • audit stub completion %
#   • run the spec pipeline (GSD → openspec → spec-kit → §43 drill)
#   • smoke-test BMAD scaffolding
#   • health check everything
#
# Usage:
#   ./setup.sh                  interactive menu
#   ./setup.sh --status         show what's installed · what's pending
#   ./setup.sh --bootstrap      §91 core + chrome + agentops + Postgres migration + stub gen + audit
#   ./setup.sh --core           §91 core only (langgraph + chromadb + websockets + httpx + WebLLM)
#   ./setup.sh --all            everything (~25 GB)
#   ./setup.sh --health         run full health check (pytest + lint + build + doctor)
#   ./setup.sh --gen-stubs      generate 48 §90 + 75 RAF stubs
#   ./setup.sh --audit          audit stub completion
#   ./setup.sh --spec-pipeline  run the spec pipeline example
#   ./setup.sh --bmad           smoke-test BMAD scaffolding
#   ./setup.sh --dry-run        preview · no changes
#   ./setup.sh --help

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

LOG_DIR="$REPO_ROOT/jobs/logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/setup.log"

PY="${PYTHON_BIN:-/media/praveen/praveenlinux21/praveen/aman/cuda/venv/bin/python}"
[ -x "$PY" ] || PY="$(command -v python3)"

DRY_RUN=0
ACTION=""

# ───────────────────────────── helpers ───────────────────────────────
log() {
  echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG"
}

log_step() { log "─── $* ───"; }

run() {
  log "  $ $*"
  [ "$DRY_RUN" = "1" ] && { log "    (DRY-RUN)"; return 0; }
  if "$@" >>"$LOG" 2>&1; then
    log "    ✓ ok"
  else
    log "    ✗ failed (exit $?) · see $LOG"
    return 1
  fi
}

# ───────────────────────────── help ──────────────────────────────────
usage() {
  cat <<'EOH'
setup.sh — consolidated AI agent + use-case stack entry point

Usage:
  ./setup.sh                  interactive menu
  ./setup.sh --status         show what's installed + pending
  ./setup.sh --bootstrap      §91 core + chrome + agentops + DB migrate + stubs
  ./setup.sh --core           §91 essentials (~250 MB)
  ./setup.sh --all            everything (~25 GB)
  ./setup.sh --health         pytest + lint + build + doctor
  ./setup.sh --gen-stubs      generate §90 + RAF stub directories
  ./setup.sh --audit          audit stub completion %
  ./setup.sh --spec-pipeline  run spec pipeline example
  ./setup.sh --bmad           smoke-test BMAD scaffolding
  ./setup.sh --dry-run        preview · no changes
  ./setup.sh --help

This script wraps:
  scripts/setup_ai_agent_stack.sh         (48 AI agent tools installer)
  scripts/download_kaggle_datasets.sh     (17 Kaggle + 3 HF datasets)
  scripts/generate_use_case_stubs.py      (48 §90 use-case stubs)
  scripts/generate_raf_stubs.py           (75 RAF stubs · Rec/Anom/Fraud)
  scripts/audit_use_case_stubs.py         (per-stub TODO completion %)
  ai-agents/_shared/examples/spec_pipeline (GSD → openspec → spec-kit drill)
  _bmad/scripts/resolve_config.py         (BMAD config resolve smoke)
  scripts/project_doctor.sh               (full project health check)
EOH
}

# ───────────────────────────── actions ───────────────────────────────
do_status() {
  log_step "Status"
  log ""
  log "REPO: $REPO_ROOT"
  log "Python: $PY"
  log "Disk available: $(df -BG --output=avail "$REPO_ROOT" | tail -1 | tr -dc '0-9') GB"
  log ""

  log "── Code ──"
  log "  Git branch: $(git branch --show-current 2>/dev/null || echo 'n/a')"
  log "  Commits ahead of origin: $(git rev-list --count @{u}.. 2>/dev/null || echo 'n/a')"
  log "  Last commit: $(git log -1 --format='%h %s' 2>/dev/null || echo 'n/a')"
  log ""

  log "── ai-agents/ inventory ──"
  if [ -d "ai-agents" ]; then
    log "  tool folders: $(find ai-agents -mindepth 1 -maxdepth 1 -type d | grep -v _shared | wc -l)"
    log "  total files:  $(find ai-agents -type f 2>/dev/null | wc -l)"
  else
    log "  ai-agents/ NOT FOUND · run --bootstrap"
  fi
  log ""

  log "── docs/use-cases/ inventory ──"
  if [ -d "docs/use-cases" ]; then
    log "  §90 stub dirs:  $(find docs/use-cases -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)"
    log "  RAF stub dirs:  $(find docs/use-cases/raf -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)"
    log "  total files:    $(find docs/use-cases -type f 2>/dev/null | wc -l)"
  else
    log "  docs/use-cases/ NOT FOUND · run --gen-stubs"
  fi
  log ""

  log "── Services ──"
  for svc in postgres redis ollama chrome; do
    if docker compose ps "$svc" 2>/dev/null | grep -q "Up"; then
      log "  $svc: ✓ Up"
    else
      log "  $svc: ✗ not running"
    fi
  done
  log ""

  log "── Frontend ──"
  if ss -tln 2>/dev/null | grep -q ":3210"; then
    log "  Vite :3210: ✓ listening"
  else
    log "  Vite :3210: ✗ not listening"
  fi
  log ""

  log "── §91 deps ──"
  for pkg in langgraph chromadb websockets httpx; do
    if "$PY" -c "import $pkg" 2>/dev/null; then
      log "  $pkg: ✓"
    else
      log "  $pkg: ✗ run --core"
    fi
  done
  log ""

  log "── §21 prompt tracker ──"
  if [ -f "scripts/prompt_tracker.py" ]; then
    log "  scripts/prompt_tracker.py: ✓"
  else
    log "  scripts/prompt_tracker.py: ✗"
  fi
  log ""

  log "── BMAD ──"
  if [ -f "_bmad/scripts/resolve_config.py" ]; then
    NAME=$("$PY" _bmad/scripts/resolve_config.py --project-root "$REPO_ROOT" --key core 2>/dev/null | grep -oE '"project_name":\s*"[^"]+"' | sed 's/.*: "\(.*\)"/\1/')
    log "  resolve_config.py: ✓ · project_name='$NAME'"
  else
    log "  _bmad/scripts/resolve_config.py: ✗"
  fi
}

do_bootstrap() {
  log_step "Bootstrap (essentials)"
  bash scripts/setup_ai_agent_stack.sh ${DRY_RUN:+--dry-run} --core
  bash scripts/setup_ai_agent_stack.sh ${DRY_RUN:+--dry-run} --tool agentops
  do_gen_stubs
  do_audit
}

do_core() {
  log_step "§91 core install"
  bash scripts/setup_ai_agent_stack.sh ${DRY_RUN:+--dry-run} --core
}

do_all() {
  log_step "ALL · 48 tools (~25 GB)"
  read -rp "  This installs ~25 GB. Proceed? (y/N) " ans
  [ "$ans" = "y" ] || { log "  aborted"; return 0; }
  bash scripts/setup_ai_agent_stack.sh ${DRY_RUN:+--dry-run} --all
}

do_health() {
  log_step "Health check"
  log ""
  log "── pytest ──"
  if [ "$DRY_RUN" = "0" ]; then
    "$PY" -m pytest backend/tests/test_input_events_router.py backend/tests/test_admin_feedback_router.py --tb=no -q 2>&1 | tail -3 | tee -a "$LOG"
  else
    log "  (DRY-RUN)"
  fi
  log ""

  log "── frontend lint + build ──"
  if [ "$DRY_RUN" = "0" ]; then
    (cd frontend && npx --no-install eslint src/hooks/useWebLLM.js src/hooks/useCDPSession.js 2>&1 | tail -3) | tee -a "$LOG"
    (cd frontend && npm run build 2>&1 | tail -3) | tee -a "$LOG"
  else
    log "  (DRY-RUN)"
  fi
  log ""

  log "── project_doctor.sh ──"
  if [ -x "scripts/project_doctor.sh" ] && [ "$DRY_RUN" = "0" ]; then
    bash scripts/project_doctor.sh 2>&1 | tail -3 | tee -a "$LOG"
  else
    log "  not present OR DRY-RUN"
  fi
  log ""

  log "── BMAD smoke ──"
  do_bmad
}

do_gen_stubs() {
  log_step "Generate use-case stubs"
  if [ -f "scripts/generate_use_case_stubs.py" ]; then
    if [ "$DRY_RUN" = "0" ]; then
      "$PY" scripts/generate_use_case_stubs.py 2>&1 | tail -3
    else
      log "  (DRY-RUN)"
    fi
  else
    log "  scripts/generate_use_case_stubs.py missing"
  fi
  log ""
  log "── RAF stubs ──"
  if [ -f "scripts/generate_raf_stubs.py" ]; then
    if [ "$DRY_RUN" = "0" ]; then
      "$PY" scripts/generate_raf_stubs.py 2>&1 | tail -3
    else
      log "  (DRY-RUN)"
    fi
  else
    log "  scripts/generate_raf_stubs.py missing"
  fi
}

do_audit() {
  log_step "Audit stub completion"
  if [ -f "scripts/audit_use_case_stubs.py" ]; then
    if [ "$DRY_RUN" = "0" ]; then
      "$PY" scripts/audit_use_case_stubs.py 2>&1 | tail -10
    else
      log "  (DRY-RUN)"
    fi
  else
    log "  scripts/audit_use_case_stubs.py missing"
  fi

  # ─── audit triad: §64.22 · §64.29 · §58/§63 · §90 L15 (4 total) ─
  log ""
  log "── §64.22 recommendation audit ──"
  [ -f scripts/audit_recommender_flavors.py ] && {
    if [ "$DRY_RUN" = "0" ]; then "$PY" scripts/audit_recommender_flavors.py 2>&1 | tail -3
    else log "  (DRY-RUN)"; fi
  }
  log ""
  log "── §64.29 dept artifacts audit ──"
  [ -f scripts/audit_dept_artifacts.py ] && {
    if [ "$DRY_RUN" = "0" ]; then "$PY" scripts/audit_dept_artifacts.py 2>&1 | tail -3
    else log "  (DRY-RUN)"; fi
  }
  log ""
  log "── §58/§63 folder README audit ──"
  [ -f scripts/audit_folder_readmes.py ] && {
    if [ "$DRY_RUN" = "0" ]; then "$PY" scripts/audit_folder_readmes.py 2>&1 | tail -3
    else log "  (DRY-RUN)"; fi
  }
  log ""
  log "── §90 L15 voice AI E2E audit ──"
  [ -f scripts/audit_voice_ai_artifacts.py ] && {
    if [ "$DRY_RUN" = "0" ]; then "$PY" scripts/audit_voice_ai_artifacts.py 2>&1 | tail -3
    else log "  (DRY-RUN)"; fi
  }
  log ""
  log "── §92 compliance audit (meta · ai-agents/ mandate) ──"
  [ -f scripts/audit_section_92_compliance.py ] && {
    if [ "$DRY_RUN" = "0" ]; then "$PY" scripts/audit_section_92_compliance.py 2>&1 | tail -3
    else log "  (DRY-RUN)"; fi
  }
}

do_spec_pipeline() {
  log_step "Spec pipeline (GSD → openspec → spec-kit → §43 drill)"
  cd ai-agents/_shared/examples/spec_pipeline 2>/dev/null && {
    if [ "$DRY_RUN" = "0" ]; then
      PY="$PY" make all 2>&1 | tail -20
    else
      log "  (DRY-RUN)"
    fi
    cd "$REPO_ROOT"
  } || log "  spec_pipeline/ missing"
}

do_bmad() {
  log_step "BMAD smoke"
  if [ -f "_bmad/scripts/resolve_config.py" ]; then
    if [ "$DRY_RUN" = "0" ]; then
      NAME=$("$PY" _bmad/scripts/resolve_config.py --project-root "$REPO_ROOT" --key core 2>/dev/null | grep -oE '"project_name":\s*"[^"]+"' | sed 's/.*: "\(.*\)"/\1/')
      AGENTS=$("$PY" _bmad/scripts/resolve_config.py --project-root "$REPO_ROOT" --key agents 2>/dev/null | "$PY" -c "import sys,json; print(len(json.load(sys.stdin).get('agents',{})))" 2>/dev/null)
      log "  project_name: $NAME"
      log "  configured agents: ${AGENTS:-?}"
      log "  resolve_config.py: ✓"
    else
      log "  (DRY-RUN)"
    fi
  else
    log "  _bmad/scripts/resolve_config.py missing"
  fi
}

# ───────────────────────────── arg parse ─────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --status) ACTION=status; shift ;;
    --bootstrap) ACTION=bootstrap; shift ;;
    --core) ACTION=core; shift ;;
    --all) ACTION=all; shift ;;
    --health) ACTION=health; shift ;;
    --gen-stubs) ACTION=gen_stubs; shift ;;
    --audit) ACTION=audit; shift ;;
    --spec-pipeline) ACTION=spec_pipeline; shift ;;
    --bmad) ACTION=bmad; shift ;;
    *) echo "Unknown: $1" >&2; usage; exit 1 ;;
  esac
done

# ───────────────────────────── execution ─────────────────────────────
if [ -n "$ACTION" ]; then
  "do_$ACTION"
  exit 0
fi

# Interactive menu
while true; do
  cat <<'EOH'

╔════════════════════════════════════════════════════════════════════╗
║  AI Agent + Use-Case Stack · Consolidated Setup                    ║
╠════════════════════════════════════════════════════════════════════╣
║  1) Status                · what's installed + what's pending      ║
║  2) Bootstrap (essentials) · §91 core + chrome + agentops + stubs  ║
║  3) Core install           · §91 essentials (~250 MB)              ║
║  4) Install ALL tools      · 48 tools (~25 GB · prompts y/N)       ║
║  5) Health check           · pytest + lint + build + doctor        ║
║  6) Generate stubs         · 48 §90 + 75 RAF stub directories      ║
║  7) Audit stub completion  · per-stub TODO completion %            ║
║  8) Spec pipeline          · GSD → openspec → spec-kit drill       ║
║  9) BMAD smoke             · resolve_config.py output              ║
║  q) Quit                                                           ║
╚════════════════════════════════════════════════════════════════════╝
EOH
  read -rp "Choice: " choice
  case "$choice" in
    1) do_status ;;
    2) do_bootstrap ;;
    3) do_core ;;
    4) do_all ;;
    5) do_health ;;
    6) do_gen_stubs ;;
    7) do_audit ;;
    8) do_spec_pipeline ;;
    9) do_bmad ;;
    q|Q) log "Exiting."; exit 0 ;;
    *) log "Invalid choice: $choice" ;;
  esac
done
