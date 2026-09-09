#!/usr/bin/env bash
# Deep testing job -- runs the real Playwright e2e suite (28 spec files)
# against the real running app and records results in Postgres
# (playwright_suite_run/playwright_test_result). Complements the existing
# health/daily/weekly quality gates (run-platform-quality-gates.sh), which
# run npm test (unit) + npm run build, not the browser e2e suite.
set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="$PROJECT_ROOT/sohamyoga-frontend"

# Playwright requires Node 20+; the system default (/usr/bin/node) is 18.19.1.
# Cron does not source .bashrc/nvm, so switch explicitly -- found live: this
# exact "You are running Node.js 18.19.1" failure on the first real run attempt.
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  \. "$NVM_DIR/nvm.sh"
  nvm use 22 >/dev/null 2>&1 || nvm use --lts >/dev/null 2>&1
fi
# 8085 is the persistent docker-hosted instance (sohamyoga-nginx/sohamyoga-frontend
# containers); 8095 is the ad-hoc local `next dev` port used during interactive
# sessions and is not guaranteed to be running. Default to 8085 -- the one
# actually expected to be up unattended, matching run-platform-quality-gates.sh.
export SOHAM_BASE_URL="${SOHAM_BASE_URL:-http://127.0.0.1:8085}"

if ! curl --fail --silent --show-error --max-time 10 "$SOHAM_BASE_URL/" >/dev/null 2>&1; then
  echo "[deep-test-suite] $SOHAM_BASE_URL is not responding -- skipping this run rather than recording a false crash against a server that was never up for an unrelated reason." >&2
  exit 0
fi

cd "$FRONTEND" && npx tsx scripts/deep-test-suite-runner.ts "$@"
