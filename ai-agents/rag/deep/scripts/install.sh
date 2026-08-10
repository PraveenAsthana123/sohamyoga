#!/usr/bin/env bash
# RAG (Chroma) · §91 core stack.
# Backend deps: pip install chromadb sentence-transformers.

set -euo pipefail
echo "Installing Chroma + sentence-transformers ..."
PIP="${PIP_BIN:-/media/praveen/praveenlinux21/praveen/aman/cuda/venv/bin/pip}"
echo "  $ $PIP install chromadb sentence-transformers pgvector"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
$PIP install --no-input chromadb sentence-transformers pgvector
echo "✓ Chroma + sentence-transformers + pgvector installed"
echo "  Verify: python -c 'import chromadb; print(chromadb.__version__)'"
