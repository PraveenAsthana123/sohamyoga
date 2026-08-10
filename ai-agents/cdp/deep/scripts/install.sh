#!/usr/bin/env bash
# Chrome DevTools Protocol · §91 core stack.
# Headless Chrome runs in docker-compose (port 9222).
# Backend deps: pip install websockets httpx (already part of --core).

set -euo pipefail
echo "Setting up CDP target (headless Chrome on :9222) ..."
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN · would run: docker compose up -d chrome)"
  exit 0
fi
REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$REPO_ROOT"
if docker compose ps chrome 2>&1 | grep -q "Up"; then
  echo "  ✓ insur_chrome already running"
else
  docker compose up -d chrome
fi
echo "  Verify: curl http://localhost:9222/json/version"
