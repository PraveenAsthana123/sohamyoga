#!/usr/bin/env bash
# setup_ai_agent_stack.sh — one-command installer for §91 WebLLM+CDP+RAG+LangGraph
# + 7 OSS agent/RPA tools (Browser-Use · Skyvern · UI-TARS · OpenAdapt ·
# OmniParser · OpenHands · AgentOps).
#
# Usage:
#   ./scripts/setup_ai_agent_stack.sh                  # interactive · pick what to install
#   ./scripts/setup_ai_agent_stack.sh --core           # §91 essentials only (~200 MB)
#   ./scripts/setup_ai_agent_stack.sh --all            # everything (~25 GB)
#   ./scripts/setup_ai_agent_stack.sh --tool agentops  # one specific tool
#   ./scripts/setup_ai_agent_stack.sh --tool browser-use --tool omniparser  # multiple
#   ./scripts/setup_ai_agent_stack.sh --dry-run        # show what would happen
#   ./scripts/setup_ai_agent_stack.sh --help
#
# Per global §91 (WebLLM+CDP+RAG+LangGraph) + tool catalog at
# docs/BROWSER_AGENT_RPA_TOOLS_SETUP.md
#
# Idempotent: skips tools already installed. Logs to jobs/logs/setup_ai_agent_stack.log.

set -uo pipefail

# ────────────────────────────────────────────────────────────────────────
# Setup
# ────────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

LOG_DIR="$REPO_ROOT/jobs/logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/setup_ai_agent_stack.log"

# Defaults · Python venv per global §61 (override via PYTHON_BIN env)
PYTHON_BIN="${PYTHON_BIN:-/media/praveen/praveenlinux21/praveen/aman/cuda/venv/bin/python}"
PIP_BIN="${PIP_BIN:-/media/praveen/praveenlinux21/praveen/aman/cuda/venv/bin/pip}"
if [ ! -x "$PYTHON_BIN" ]; then
  PYTHON_BIN="$(command -v python3 || echo python3)"
  PIP_BIN="$(command -v pip3 || echo pip3)"
fi
NPM_BIN="$(command -v npm || echo npm)"
DOCKER_BIN="$(command -v docker || echo docker)"

DRY_RUN=0
INTERACTIVE=1
SELECTED_TOOLS=()

# ────────────────────────────────────────────────────────────────────────
# Logging
# ────────────────────────────────────────────────────────────────────────
log() {
  local ts; ts="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[$ts] $*" | tee -a "$LOG"
}

log_step() { log "─── $* ───"; }

# ────────────────────────────────────────────────────────────────────────
# Tool list (single source of truth)
# ────────────────────────────────────────────────────────────────────────
# Each tool: ID · short-name · size · description
ALL_TOOLS=(
  "core|§91 core deps (langgraph+chromadb+websockets+httpx + npm @mlc-ai/web-llm)|~250 MB|MUST-have for WebLLM+CDP+RAG+LangGraph"
  "chrome|Chrome 9222 docker service|~150 MB|CDP target for §91"
  "agentops|AgentOps OSS SDK|~10 MB|Agent observability/cost/trace · pip install"
  "browser-use|Browser-Use + Playwright Chromium|~150 MB|LLM-driven browser automation"
  "omniparser|OmniParser (Microsoft)|~200 MB|GUI screenshot → structured DOM"
  "skyvern|Skyvern OSS|~500 MB|Production RPA browser agent · docker compose"
  "openadapt|OpenAdapt|~50 MB|Desktop+browser process recorder"
  "ui-tars|UI-TARS-7B (ByteDance)|~7 GB|Vision-language model · needs 16GB GPU"
  "openhands|OpenHands|~3 GB|Autonomous coding agent · docker"
)

usage() {
  cat <<'EOH'
setup_ai_agent_stack.sh — one-command AI agent stack installer

Usage:
  ./scripts/setup_ai_agent_stack.sh              interactive · pick what to install
  ./scripts/setup_ai_agent_stack.sh --core       §91 essentials only (~250 MB)
  ./scripts/setup_ai_agent_stack.sh --all        everything (~25 GB · needs GPU for UI-TARS)
  ./scripts/setup_ai_agent_stack.sh --tool agentops --tool browser-use   multiple
  ./scripts/setup_ai_agent_stack.sh --dry-run    preview only
  ./scripts/setup_ai_agent_stack.sh --help

Tools available:
EOH
  for t in "${ALL_TOOLS[@]}"; do
    IFS='|' read -r id name size desc <<<"$t"
    printf "  %-13s %-50s %-10s %s\n" "$id" "$name" "$size" "$desc"
  done
  cat <<'EOH'

Recommended adoption order (per docs/BROWSER_AGENT_RPA_TOOLS_SETUP.md):
  1. core + chrome    install first
  2. agentops         observability before anything else
  3. browser-use      ~80% of CDP use cases
  4. omniparser       cheap vision capability
  5. skyvern          production RPA workflows
  6. openadapt        compliance-recorded workflows + training data
  7. ui-tars          OCR-free vision (GPU required)
  8. openhands        code-agent for DevOps tasks

Environment:
  PYTHON_BIN=/path/to/python   override Python interpreter
  PIP_BIN=/path/to/pip         override pip
EOH
}

# ────────────────────────────────────────────────────────────────────────
# Parse args
# ────────────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --core)   SELECTED_TOOLS=("core" "chrome"); INTERACTIVE=0; shift ;;
    --all)    SELECTED_TOOLS=("core" "chrome" "agentops" "browser-use" "omniparser" "skyvern" "openadapt" "ui-tars" "openhands"); INTERACTIVE=0; shift ;;
    --tool)   SELECTED_TOOLS+=("$2"); INTERACTIVE=0; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

# ────────────────────────────────────────────────────────────────────────
# Interactive picker
# ────────────────────────────────────────────────────────────────────────
if [ "$INTERACTIVE" = "1" ]; then
  echo "Pick what to install (space-separated numbers · or 'all' · or 'core'):"
  i=1
  IDS=()
  for t in "${ALL_TOOLS[@]}"; do
    IFS='|' read -r id name size desc <<<"$t"
    printf "  %d) %-13s %-50s %s\n" "$i" "$id" "$name" "$size"
    IDS+=("$id")
    i=$((i+1))
  done
  echo ""
  read -rp "Choice: " CHOICE
  if [ "$CHOICE" = "all" ]; then
    SELECTED_TOOLS=("${IDS[@]}")
  elif [ "$CHOICE" = "core" ]; then
    SELECTED_TOOLS=("core" "chrome")
  else
    for n in $CHOICE; do
      idx=$((n-1))
      if [ "$idx" -ge 0 ] && [ "$idx" -lt "${#IDS[@]}" ]; then
        SELECTED_TOOLS+=("${IDS[$idx]}")
      fi
    done
  fi
fi

if [ "${#SELECTED_TOOLS[@]}" -eq 0 ]; then
  log "No tools selected. Use --core for essentials or --all for everything."
  exit 0
fi

log_step "Starting setup · Selected: ${SELECTED_TOOLS[*]}"
log "Python: $PYTHON_BIN"
log "pip: $PIP_BIN"
log "Log: $LOG"

# ────────────────────────────────────────────────────────────────────────
# Pre-flight checks
# ────────────────────────────────────────────────────────────────────────
log_step "Pre-flight"

check_cmd() {
  if command -v "$1" >/dev/null 2>&1; then
    log "  ✓ $1 found ($(command -v "$1"))"
    return 0
  else
    log "  ✗ $1 missing"
    return 1
  fi
}

# Disk space check (need >25 GB for --all · >250 MB for --core)
AVAIL_GB=$(df -BG --output=avail "$REPO_ROOT" | tail -1 | tr -dc '0-9')
log "  Disk available: ${AVAIL_GB} GB"
if [ "$AVAIL_GB" -lt 5 ] && [[ " ${SELECTED_TOOLS[*]} " =~ " ui-tars " || " ${SELECTED_TOOLS[*]} " =~ " openhands " ]]; then
  log "  ⚠ Less than 5 GB free · UI-TARS or OpenHands install may fail"
fi

check_cmd "$PYTHON_BIN" || { log "Python not found · set PYTHON_BIN env"; exit 2; }
check_cmd "$PIP_BIN" || { log "pip not found"; exit 2; }
[[ " ${SELECTED_TOOLS[*]} " =~ " chrome " || " ${SELECTED_TOOLS[*]} " =~ " skyvern " || " ${SELECTED_TOOLS[*]} " =~ " openhands " ]] && {
  check_cmd "$DOCKER_BIN" || { log "docker not found · install Docker first"; exit 2; }
}
[[ " ${SELECTED_TOOLS[*]} " =~ " core " ]] && {
  check_cmd "$NPM_BIN" || { log "npm not found · install Node.js first"; exit 2; }
}
[[ " ${SELECTED_TOOLS[*]} " =~ " ui-tars " ]] && {
  check_cmd git-lfs || log "  ⚠ git-lfs missing · UI-TARS install will fail · sudo apt install git-lfs"
}

# ────────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────────
run_cmd() {
  log "  $ $*"
  if [ "$DRY_RUN" = "1" ]; then
    log "    (DRY-RUN · skipped)"
    return 0
  fi
  if "$@" >>"$LOG" 2>&1; then
    log "    ✓ ok"
    return 0
  else
    log "    ✗ failed (exit $?) · see $LOG"
    return 1
  fi
}

pip_install_if_missing() {
  local pkg="$1"; shift
  if "$PYTHON_BIN" -c "import ${pkg//-/_}" >/dev/null 2>&1; then
    log "  ✓ python pkg $pkg already installed"
    return 0
  fi
  run_cmd "$PIP_BIN" install --no-input "$pkg" "$@"
}

npm_install_if_missing() {
  local pkg="$1"
  cd "$REPO_ROOT/frontend"
  if npm ls "$pkg" >/dev/null 2>&1; then
    log "  ✓ npm pkg $pkg already installed"
    cd "$REPO_ROOT"; return 0
  fi
  run_cmd npm install --save "$pkg"
  cd "$REPO_ROOT"
}

# ────────────────────────────────────────────────────────────────────────
# Install each selected tool
# ────────────────────────────────────────────────────────────────────────
for tool in "${SELECTED_TOOLS[@]}"; do
  case "$tool" in

    core)
      log_step "core · §91 essentials"
      pip_install_if_missing langgraph
      pip_install_if_missing chromadb
      pip_install_if_missing websockets
      pip_install_if_missing httpx
      pip_install_if_missing langchain
      pip_install_if_missing "langchain-community"
      pip_install_if_missing pgvector
      npm_install_if_missing @mlc-ai/web-llm
      log "  Verify: $PYTHON_BIN -c 'import langgraph, chromadb, websockets, httpx; print(\"ok\")'"
      ;;

    chrome)
      log_step "chrome · headless Chrome 9222 docker service"
      if "$DOCKER_BIN" compose ps chrome 2>&1 | grep -q "Up"; then
        log "  ✓ insur_chrome already running"
      else
        run_cmd "$DOCKER_BIN" compose up -d chrome
      fi
      log "  Verify: curl http://localhost:9222/json/version"
      ;;

    agentops)
      log_step "agentops · agent observability"
      pip_install_if_missing agentops
      log "  Setup: export AGENTOPS_API_KEY=\"dev\" · then import agentops in your code"
      log "  Quickstart: agentops.init(default_tags=['my-project']); @agentops.track_agent(...)"
      ;;

    browser-use)
      log_step "browser-use · LLM-driven browser automation"
      pip_install_if_missing "browser-use"
      pip_install_if_missing playwright
      if [ "$DRY_RUN" = "0" ]; then
        run_cmd "$PYTHON_BIN" -m playwright install chromium
      else
        log "  $ python -m playwright install chromium (DRY-RUN)"
      fi
      log "  Verify: $PYTHON_BIN -c 'from browser_use import Agent; print(\"ok\")'"
      ;;

    omniparser)
      log_step "omniparser · GUI screenshot → DOM (Microsoft)"
      local OMNI_DIR="$REPO_ROOT/vendor/OmniParser"
      if [ -d "$OMNI_DIR" ]; then
        log "  ✓ OmniParser already cloned at $OMNI_DIR"
      else
        run_cmd git clone https://github.com/microsoft/OmniParser.git "$OMNI_DIR"
      fi
      if [ -f "$OMNI_DIR/requirements.txt" ]; then
        run_cmd "$PIP_BIN" install -r "$OMNI_DIR/requirements.txt"
      fi
      pip_install_if_missing huggingface-hub
      if [ "$DRY_RUN" = "0" ]; then
        run_cmd "$PYTHON_BIN" -m huggingface_hub.commands.huggingface_cli download \
          microsoft/OmniParser --local-dir "$OMNI_DIR/weights/"
      else
        log "  $ huggingface-cli download microsoft/OmniParser (DRY-RUN)"
      fi
      log "  Serve: cd vendor/OmniParser && python serve.py --port 8003"
      ;;

    skyvern)
      log_step "skyvern · production RPA browser agent (AGPL-3.0)"
      local SKY_DIR="$REPO_ROOT/vendor/skyvern"
      if [ -d "$SKY_DIR" ]; then
        log "  ✓ Skyvern already cloned"
      else
        run_cmd git clone https://github.com/Skyvern-AI/skyvern.git "$SKY_DIR"
      fi
      if [ -f "$SKY_DIR/docker-compose.yml" ]; then
        log "  Skyvern docker-compose.yml present · start with:"
        log "    cd vendor/skyvern && docker compose up -d"
        log "  Skipping auto-start to avoid port collision · operator-decision"
      fi
      log "  Verify: curl http://localhost:8000/api/v1/tasks (after starting)"
      ;;

    openadapt)
      log_step "openadapt · desktop+browser process recorder"
      pip_install_if_missing openadapt
      log "  Quickstart: openadapt record  (then perform a workflow)"
      log "             openadapt visualize  (see capture)"
      log "             openadapt replay  (LLM-replay)"
      ;;

    ui-tars)
      log_step "ui-tars · ByteDance vision-language model (~7 GB · GPU)"
      if ! command -v git-lfs >/dev/null 2>&1; then
        log "  ✗ git-lfs missing · sudo apt install git-lfs first"
        continue
      fi
      run_cmd git lfs install --skip-repo
      local UI_TARS_DIR="$HOME/models/ui-tars"
      if [ -d "$UI_TARS_DIR/.git" ]; then
        log "  ✓ UI-TARS already cloned at $UI_TARS_DIR"
      else
        mkdir -p "$(dirname "$UI_TARS_DIR")"
        run_cmd git clone https://huggingface.co/bytedance-research/UI-TARS-7B-DPO "$UI_TARS_DIR"
      fi
      pip_install_if_missing vllm
      log "  Serve: python -m vllm.entrypoints.openai.api_server \\"
      log "           --model $UI_TARS_DIR \\"
      log "           --port 8002 --max-model-len 8192"
      ;;

    openhands)
      log_step "openhands · autonomous coding agent (docker)"
      local IMAGE="docker.all-hands.dev/all-hands-ai/openhands:0.10"
      if "$DOCKER_BIN" images "$IMAGE" --format "{{.Repository}}" 2>&1 | grep -q "openhands"; then
        log "  ✓ OpenHands image already pulled"
      else
        run_cmd "$DOCKER_BIN" pull "$IMAGE"
      fi
      log "  Start: docker run -p 3000:3000 -v /var/run/docker.sock:/var/run/docker.sock $IMAGE"
      log "  UI:    http://localhost:3000"
      ;;

    *)
      log "  ⚠ Unknown tool: $tool · skipping"
      ;;
  esac
done

# ────────────────────────────────────────────────────────────────────────
# Summary
# ────────────────────────────────────────────────────────────────────────
log_step "Summary"
log "Selected: ${SELECTED_TOOLS[*]}"
log "Log file: $LOG"

if [ "$DRY_RUN" = "1" ]; then
  log "DRY-RUN complete · no changes made. Re-run without --dry-run to install."
else
  log "Done. Verify your installation:"
  log "  Python deps:  $PYTHON_BIN -c 'import langgraph, chromadb, websockets, httpx; print(\"ok\")'"
  log "  Chrome:       curl -s http://localhost:9222/json/version | head"
  log "  Backend:      curl -s http://localhost:8001/api/v1/webllm-agent/health"
  log "  Frontend hook: ls frontend/src/hooks/useWebLLM.js"
fi

log "Per §91 + docs/BROWSER_AGENT_RPA_TOOLS_SETUP.md"
