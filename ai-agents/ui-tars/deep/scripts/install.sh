#!/usr/bin/env bash
set -euo pipefail
command -v git-lfs >/dev/null || { echo "Install git-lfs first: sudo apt install git-lfs"; exit 1; }
git lfs install
test -d ~/models/ui-tars/.git || git clone https://huggingface.co/bytedance-research/UI-TARS-7B-DPO ~/models/ui-tars
pip install vllm
echo "Serve via:"
echo "  python -m vllm.entrypoints.openai.api_server --model ~/models/ui-tars --port 8002"
