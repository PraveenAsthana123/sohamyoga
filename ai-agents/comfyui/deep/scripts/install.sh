#!/usr/bin/env bash
set -euo pipefail
echo "Installing ComfyUI ..."
echo "  $ git clone https://github.com/comfyanonymous/ComfyUI && cd ComfyUI && pip install -r requirements.txt && python main.py"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
git clone https://github.com/comfyanonymous/ComfyUI && cd ComfyUI && pip install -r requirements.txt && python main.py
echo "✓ ComfyUI installed"
if [ "none" != "none" ]; then
  echo ""
  echo "Setup required: none"
fi
