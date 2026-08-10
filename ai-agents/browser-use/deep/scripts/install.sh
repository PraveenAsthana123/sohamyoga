#!/usr/bin/env bash
set -euo pipefail
pip install browser-use playwright
python -m playwright install chromium
echo "✓ Browser-Use ready · import via: from browser_use import Agent, Browser"
