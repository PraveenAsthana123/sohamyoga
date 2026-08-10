#!/usr/bin/env bash
# LangGraph · §91 core stack · stateful agent DAG.
# Backend deps: pip install langgraph langchain langchain-community.

set -euo pipefail
echo "Installing langgraph + langchain ..."
PIP="${PIP_BIN:-/media/praveen/praveenlinux21/praveen/aman/cuda/venv/bin/pip}"
echo "  $ $PIP install langgraph langchain langchain-community"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
$PIP install --no-input langgraph langchain langchain-community
echo "✓ langgraph + langchain installed"
echo "  Verify: python -c 'import langgraph; print(langgraph.__version__)'"
