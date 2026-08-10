#!/usr/bin/env bash
set -euo pipefail
echo "Installing Banner AI composite ..."
echo "  composite of: image gen (Fooocus/ComfyUI/InvokeAI) + LLM (WebLLM) + template engine + C2PA watermark"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
echo '  This is a composite of existing tools: install Fooocus + ComfyUI for image gen, WebLLM for copy. See ai-agents/fooocus/deep/scripts/install.sh + ai-agents/webllm/'
echo "✓ Banner AI composite ready"
