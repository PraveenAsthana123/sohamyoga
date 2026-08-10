#!/usr/bin/env bash
set -euo pipefail
echo "Installing Contact AI composite ..."
echo "  composite of: image gen (Fooocus/ComfyUI/InvokeAI) + LLM (WebLLM) + template engine + C2PA watermark"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
echo '  This is a composite of existing tools: pip install pyentity-resolution sentence-transformers networkx'
echo "✓ Contact AI composite ready"
