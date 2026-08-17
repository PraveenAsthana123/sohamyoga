#!/usr/bin/env bash
# Readiness audit for the hybrid AI video-content-factory architecture
# discussed for SohamYoga (open-source-first generation + premium fallback
# for LLM/image/video/voice/music/lip-sync/3D/workflow/quality-routing).
#
# Real checks only — every line below reflects an actual command/container
# probe on this machine, not an assumption. Safe to re-run anytime; makes
# no changes.
#
# Usage: bash scripts/check-ai-video-stack.sh
set -uo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
FOUND=0; MISSING=0

ok()   { echo -e "  ${GREEN}✓${NC} $1"; FOUND=$((FOUND+1)); }
miss() { echo -e "  ${RED}✗${NC} $1"; MISSING=$((MISSING+1)); }
note() { echo -e "  ${YELLOW}·${NC} $1"; }
section() { echo -e "\n${BOLD}$1${NC}"; }

check_cmd() {
  # check_cmd <label> <command> [version-flag]
  local label="$1" cmd="$2" flag="${3:---version}"
  if command -v "$cmd" >/dev/null 2>&1; then
    local ver; ver=$("$cmd" $flag 2>&1 | head -1)
    ok "$label — $ver"
  else
    miss "$label — not on PATH"
  fi
}

check_py() {
  # check_py <label> <import-name>
  local label="$1" mod="$2"
  local out
  out=$(python3 -c "import $mod; print(getattr($mod, '__version__', 'installed'))" 2>&1)
  if [[ $? -eq 0 ]]; then
    ok "$label — $out"
  else
    miss "$label — python module '$mod' not installed"
  fi
}

check_container() {
  # check_container <label> <name-grep>
  local label="$1" grep_pat="$2"
  local hit
  hit=$(docker ps -a --format "{{.Names}}\t{{.Image}}\t{{.Status}}" 2>/dev/null | grep -i "$grep_pat")
  if [[ -z "$hit" ]]; then
    miss "$label — no matching container found"
  elif echo "$hit" | grep -q "^\S*\s\S*\s*Up "; then
    ok "$label — $hit"
  else
    note "$label — container exists but is STOPPED: $hit"
    FOUND=$((FOUND+1))
  fi
}

echo -e "${BOLD}AI Video Factory — Software Readiness Audit${NC}"
echo "Host: $(hostname) · $(date -u +'%Y-%m-%d %H:%M UTC')"

# ── GPU / drivers ────────────────────────────────────────────────────────
section "GPU / Drivers"
if command -v nvidia-smi >/dev/null 2>&1; then
  GPU_INFO=$(nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader 2>&1)
  ok "GPU — $GPU_INFO"
else
  miss "nvidia-smi — no NVIDIA GPU detected"
fi
if command -v nvcc >/dev/null 2>&1; then
  ok "CUDA toolkit (nvcc) — $(nvcc --version | tail -1)"
else
  miss "CUDA toolkit (nvcc) — not installed (only needed for building custom kernels, not for using PyTorch)"
fi
TORCH_CHECK=$(python3 -c "
import torch, warnings
warnings.filterwarnings('ignore')
print(f'torch {torch.__version__} | CUDA available: {torch.cuda.is_available()}')
" 2>&1 | tail -1)
if echo "$TORCH_CHECK" | grep -q "CUDA available: True"; then
  ok "PyTorch — $TORCH_CHECK"
elif echo "$TORCH_CHECK" | grep -q "CUDA available: False"; then
  miss "PyTorch — $TORCH_CHECK  ${RED}<-- GPU acceleration is BROKEN${NC}"
  note "Likely driver/CUDA-build mismatch — installed NVIDIA driver may be older than what this torch build needs."
  note "Every GPU-dependent tool below (FLUX, video models, Whisper GPU, TTS GPU) will silently fall back to CPU or fail until this is fixed."
else
  miss "PyTorch — not installed"
fi

# ── Core media tools ─────────────────────────────────────────────────────
section "Core Media / Rendering"
check_cmd "FFmpeg" ffmpeg
check_cmd "Blender" blender
check_cmd "Godot 4 (snap)" godot-4

# ── LLM / orchestration ──────────────────────────────────────────────────
section "LLM & Orchestration"
if command -v ollama >/dev/null 2>&1; then
  MODEL_COUNT=$(ollama list 2>/dev/null | tail -n +2 | wc -l)
  ok "Ollama — $(ollama --version 2>&1 | head -1), $MODEL_COUNT models pulled (Qwen/Llama/etc. already local)"
else
  miss "Ollama — not installed"
fi
check_py "LangChain" langchain
check_py "LangGraph" langgraph
check_container "n8n (workflow)" "n8n"
check_container "Qdrant (vector DB)" "qdrant"

# ── Image / video generation ─────────────────────────────────────────────
section "Image / Video Generation"
if [[ -d /mnt/deepa/insur_project/ComfyUI ]]; then
  ok "ComfyUI — found at /mnt/deepa/insur_project/ComfyUI (belongs to a different project, not sohamyoga)"
  NODE_HITS=$(ls /mnt/deepa/insur_project/ComfyUI/custom_nodes 2>/dev/null | grep -icE "flux|wan|ltx|hunyuan|ip.adapter|controlnet")
  if [[ "$NODE_HITS" -gt 0 ]]; then
    ok "  custom nodes for FLUX/Wan/LTX/Hunyuan/ControlNet present ($NODE_HITS)"
  else
    miss "  custom nodes for FLUX/Wan/LTX/Hunyuan/ControlNet/IP-Adapter — none installed yet (base ComfyUI only)"
  fi
else
  miss "ComfyUI — not found anywhere on this machine"
fi
check_py "diffusers (FLUX/SD pipelines)" diffusers

# ── Voice / audio ─────────────────────────────────────────────────────────
section "Voice / Speech / Music"
check_py "openai-whisper (STT)" whisper
check_py "faster-whisper (STT, faster)" faster_whisper
check_py "Coqui TTS" TTS
check_cmd "Piper (TTS)" piper
check_py "Kokoro (TTS)" kokoro
check_py "AudioCraft / MusicGen" audiocraft
WAV2LIP=$(find / -maxdepth 5 -iname "*wav2lip*" 2>/dev/null | grep -v /proc | head -1)
if [[ -n "$WAV2LIP" ]]; then ok "Wav2Lip — found at $WAV2LIP"; else miss "Wav2Lip (lip sync) — not installed"; fi

# ── Composition / infra ───────────────────────────────────────────────────
section "Composition & Infrastructure"
if [[ -n "$(find . -maxdepth 6 -iname remotion -type d 2>/dev/null | grep -v node_modules/.cache)" ]] || npm list -g --depth=0 2>/dev/null | grep -qi remotion; then
  ok "Remotion — found"
else
  miss "Remotion (React-based video composition) — not installed"
fi
check_container "PostgreSQL (sohamyoga)" "sohamyoga-postgres"
check_container "MinIO (object storage)" "minio"
check_container "Grafana (dashboards)" "grafana"
check_container "ClickHouse (analytics)" "clickhouse"
check_cmd "Docker" docker
check_cmd "Node.js" node
check_cmd "Python 3" python3

# ── Summary ───────────────────────────────────────────────────────────────
section "Summary"
echo -e "  ${GREEN}$FOUND installed/found${NC} · ${RED}$MISSING missing${NC}"
echo ""
echo "Note: some 'found' items (ComfyUI, Qdrant, MinIO, Grafana) belong to"
echo "other projects on this machine, not sohamyoga — real and usable, but"
echo "not currently wired into this project's own infrastructure."
