#!/usr/bin/env bash
set -u
ROOT=/mnt/deepa/sohamyoga
FRONTEND="$ROOT/sohamyoga-frontend"
source "$HOME/.config/sohamyoga/ports.env"
export SOHAM_BASE_URL="http://127.0.0.1:$SOHAM_FRONTEND_PORT"
mkdir -p "$FRONTEND/test-results"
heal_service(){ local unit="$1" url="$2" code; code=$(curl -sS -o /dev/null --max-time 10 -w '%{http_code}' "$url" 2>/dev/null || echo 000); if ! systemctl --user is-active --quiet "$unit" || [[ "$code" == 000 || "$code" -ge 500 ]]; then systemctl --user restart "$unit"; sleep 5; fi; }
heal_service soham-backend.service "http://127.0.0.1:$SOHAM_BACKEND_PORT/api/auth/me"
heal_service soham-frontend.service "$SOHAM_BASE_URL/"
cd "$FRONTEND"
timeout 60s npm run test:stagehand > test-results/stagehand-latest.log 2>&1 || true
npx playwright test --project=chrome-desktop --reporter=json > test-results/unified-quality.next.json || true
if node -e "JSON.parse(require('fs').readFileSync('test-results/unified-quality.next.json','utf8'))" 2>/dev/null; then mv test-results/unified-quality.next.json test-results/unified-quality.json; fi
# Failures remain evidence for the dashboard. Repair is delegated; code is never silently rewritten.
if node -e "const r=require('./test-results/unified-quality.json');process.exit((r.stats?.unexpected||0)>0?0:1)"; then
  OLL_ACTOR=quality-self-heal timeout 90s "$HOME/.local/bin/oll" plan "SohamYoga quality failures detected. Review $FRONTEND/test-results/unified-quality.json, propose a minimal patch, run tests, and do not publish or perform destructive changes." >/dev/null 2>&1 || true
fi
