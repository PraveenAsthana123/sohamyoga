#!/usr/bin/env bash
set -euo pipefail
echo "Installing AssemblyAI ..."
pip install assemblyai OR npm assemblyai
echo "✓ AssemblyAI installed"
if [ "ASSEMBLYAI_API_KEY" != "none" ]; then
  echo ""
  echo "API key setup required:"
  echo "  ASSEMBLYAI_API_KEY"
  echo "Export the env vars before using."
fi
