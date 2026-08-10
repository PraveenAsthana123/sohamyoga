#!/usr/bin/env bash
set -euo pipefail
echo "Installing AUTOMATIC1111 SD WebUI ..."
echo "  $ git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui && cd stable-diffusion-webui && bash webui.sh"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui && cd stable-diffusion-webui && bash webui.sh
echo "✓ AUTOMATIC1111 SD WebUI installed"
if [ "none" != "none" ]; then
  echo ""
  echo "Setup required: none"
fi
