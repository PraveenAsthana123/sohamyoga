#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
test -d OmniParser || git clone https://github.com/microsoft/OmniParser.git
cd OmniParser && pip install -r requirements.txt
pip install huggingface-hub
huggingface-cli download microsoft/OmniParser --local-dir ./weights/
echo "✓ OmniParser ready · python serve.py --port 8003"
