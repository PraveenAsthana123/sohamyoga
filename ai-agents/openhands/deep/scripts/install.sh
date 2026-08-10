#!/usr/bin/env bash
set -euo pipefail
docker pull docker.all-hands.dev/all-hands-ai/openhands:0.10
echo "Start with:"
echo "  docker run -p 3000:3000 -v /var/run/docker.sock:/var/run/docker.sock \\"
echo "    docker.all-hands.dev/all-hands-ai/openhands:0.10"
echo "Then open http://localhost:3000"
