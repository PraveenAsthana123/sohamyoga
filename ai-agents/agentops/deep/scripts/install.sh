#!/usr/bin/env bash
set -euo pipefail
pip install agentops
echo "✓ AgentOps ready"
echo "Setup: export AGENTOPS_API_KEY=\"dev\""
echo "Code:  import agentops; agentops.init(default_tags=['my-project'])"
