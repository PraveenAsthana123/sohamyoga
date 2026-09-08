#!/usr/bin/env bash
# Real port-conflict checker -- built 2026-09-01 after a live incident where
# sohamyoga-nginx (docker-compose, port 8085) silently collided with the
# local `next dev` server also defaulting to 8085, producing confusing
# 404s that looked like application bugs. Run this before starting any dev
# server or assigning a new port anywhere in this workspace.
#
# Usage: scripts/check-port-registry.sh <port>
#   Exit 0 + prints "FREE" if nothing is listening on the port.
#   Exit 1 + prints what's actually bound (process or docker container) if taken.
set -euo pipefail

PORT="${1:-}"
if [[ -z "$PORT" ]]; then
  echo "Usage: $0 <port>" >&2
  exit 2
fi

LISTENING=$(ss -tlnp 2>/dev/null | awk -v p=":$PORT\$" '$4 ~ p {print}')
DOCKER_MATCH=$(docker ps --format '{{.Names}}\t{{.Ports}}' 2>/dev/null | grep -F ":$PORT->" || true)

if [[ -z "$LISTENING" && -z "$DOCKER_MATCH" ]]; then
  echo "FREE: port $PORT is not in use."
  exit 0
fi

echo "TAKEN: port $PORT is already in use." >&2
if [[ -n "$DOCKER_MATCH" ]]; then
  echo "  Docker container: $DOCKER_MATCH" >&2
fi
if [[ -n "$LISTENING" ]]; then
  echo "  Listening socket: $LISTENING" >&2
fi
echo "  See PORT_REGISTRY.md before picking a replacement port." >&2
exit 1
