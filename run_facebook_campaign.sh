#!/usr/bin/env bash
set -euo pipefail

ROOT="/mnt/deepa/sohamyoga"
FRONTEND="http://127.0.0.1:8085"
BACKEND="http://127.0.0.1:15070"
POSTIZ="http://127.0.0.1:15080"

CAMPAIGN_DIR="$ROOT/campaigns"
LOG_DIR="$ROOT/logs/facebook-campaigns"

mkdir -p "$CAMPAIGN_DIR" "$LOG_DIR"

echo "============================================================"
echo "          SOHAMYOGA FACEBOOK CAMPAIGN RUNNER"
echo "============================================================"

echo
echo "1. SERVICE HEALTH"
echo "------------------------------------------------------------"

BACKEND_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  --max-time 5 "$BACKEND/api/health" || true)

POSTIZ_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  --max-time 5 "$POSTIZ" || true)

FRONTEND_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  --max-time 5 "$FRONTEND" || true)

echo "Backend :15070 -> ${BACKEND_CODE:-DOWN}"
echo "Postiz  :15080 -> ${POSTIZ_CODE:-DOWN}"
echo "Frontend:8085  -> ${FRONTEND_CODE:-DOWN}"

if [ "$BACKEND_CODE" != "200" ]; then
  echo "❌ SohamYoga backend unavailable."
  exit 1
fi

if [ -z "$POSTIZ_CODE" ] || [ "$POSTIZ_CODE" = "000" ]; then
  echo "❌ Postiz unavailable."
  exit 1
fi

if [ -z "$FRONTEND_CODE" ] || [ "$FRONTEND_CODE" = "000" ]; then
  echo "❌ SohamYoga frontend unavailable."
  exit 1
fi

echo "✅ Core services available"

echo
echo "2. CREATE CAMPAIGN"
echo "------------------------------------------------------------"

read -rp "Campaign name: " CAMPAIGN_NAME
read -rp "Facebook Page name: " PAGE_NAME

echo
echo "Enter post text."
echo "Finish by entering a blank line."
echo

POST_TEXT=""
while IFS= read -r line; do
  [ -z "$line" ] && break
  POST_TEXT="${POST_TEXT}${line}\n"
done

read -rp "Image/video path (Enter for none): " MEDIA_PATH

echo
echo "Publishing mode:"
echo "1 = Draft only"
echo "2 = Schedule"
echo "3 = Publish now"
read -rp "Choose [1/2/3]: " MODE

PUBLISH_MODE="draft"
SCHEDULE_AT=""

case "$MODE" in
  1)
    PUBLISH_MODE="draft"
    ;;
  2)
    PUBLISH_MODE="schedule"
    read -rp "Schedule time (example 2026-08-10T09:00:00-06:00): " SCHEDULE_AT
    ;;
  3)
    PUBLISH_MODE="publish"
    ;;
  *)
    echo "❌ Invalid publishing mode"
    exit 1
    ;;
esac

if [ -n "$MEDIA_PATH" ] && [ ! -f "$MEDIA_PATH" ]; then
  echo "❌ Media file does not exist:"
  echo "$MEDIA_PATH"
  exit 1
fi

SAFE_NAME=$(echo "$CAMPAIGN_NAME" \
  | tr '[:upper:]' '[:lower:]' \
  | sed 's/[^a-z0-9]/-/g' \
  | sed 's/--*/-/g' \
  | sed 's/^-//' \
  | sed 's/-$//')

STAMP=$(date '+%Y%m%d-%H%M%S')
CAMPAIGN_FILE="$CAMPAIGN_DIR/${STAMP}-${SAFE_NAME}.json"

python3 - "$CAMPAIGN_FILE" \
  "$CAMPAIGN_NAME" \
  "$PAGE_NAME" \
  "$POST_TEXT" \
  "$MEDIA_PATH" \
  "$PUBLISH_MODE" \
  "$SCHEDULE_AT" <<'PY'
import json
import sys
from datetime import datetime, timezone

(
    path,
    campaign_name,
    page_name,
    post_text,
    media_path,
    publish_mode,
    schedule_at,
) = sys.argv[1:]

payload = {
    "campaignName": campaign_name,
    "platform": "facebook",
    "pageName": page_name,
    "postText": post_text.replace("\\n", "\n").strip(),
    "mediaPath": media_path or None,
    "publishMode": publish_mode,
    "scheduleAt": schedule_at or None,

    # Safer default until Facebook connection is fully proven.
    "approvalRequired": True,

    "retry": {
        "maxAttempts": 3,
        "backoffSeconds": [30, 120, 300]
    },

    "metadata": {
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "source": "run_facebook_campaign.sh"
    }
}

with open(path, "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2)

print(path)
PY

echo
echo "✅ Campaign created:"
echo "$CAMPAIGN_FILE"

echo
echo "3. CAMPAIGN PREVIEW"
echo "------------------------------------------------------------"
cat "$CAMPAIGN_FILE"

echo
echo
echo "4. CONNECTION CHECK"
echo "------------------------------------------------------------"

CALLBACK_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  --max-time 5 \
  "$FRONTEND/api/socials/facebook/callback" || true)

echo "Facebook callback -> HTTP $CALLBACK_CODE"

if [ "$CALLBACK_CODE" = "307" ]; then
  echo "✅ Facebook/Postiz callback wiring detected."
else
  echo "⚠️ Facebook callback did not return expected redirect."
fi

echo
echo "5. APPROVAL"
echo "------------------------------------------------------------"

if [ "$PUBLISH_MODE" = "draft" ]; then
  echo "✅ Draft mode selected."
  echo "No externally visible Facebook publication will be attempted."
  exit 0
fi

read -rp "Continue with campaign execution? [yes/NO]: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Campaign saved as draft:"
  echo "$CAMPAIGN_FILE"
  exit 0
fi

echo
echo "6. EXECUTE EXISTING MARKETING AUTOMATION JOB"
echo "------------------------------------------------------------"

LOGFILE="$LOG_DIR/${STAMP}-${SAFE_NAME}.log"

# The existing project has been observed running:
# src/cron/jobs/MarketingAutomationJob.ts
#
# We intentionally call the existing runner rather than guessing
# Postiz's internal publishing endpoint.

if [ -f "$ROOT/package.json" ] && \
   [ -f "$ROOT/src/cron/jobs/MarketingAutomationJob.ts" ]; then

  cd "$ROOT"

  CAMPAIGN_FILE="$CAMPAIGN_FILE" \
  FACEBOOK_CAMPAIGN_FILE="$CAMPAIGN_FILE" \
  pnpm exec tsx -e \
    "import('./src/cron/jobs/MarketingAutomationJob.ts').then(m=>(m.run||m.default?.run)()).catch(e=>{console.error(e);process.exit(1)})" \
    2>&1 | tee "$LOGFILE"

elif [ -f "/app/src/cron/jobs/MarketingAutomationJob.ts" ]; then

  cd /app

  CAMPAIGN_FILE="$CAMPAIGN_FILE" \
  FACEBOOK_CAMPAIGN_FILE="$CAMPAIGN_FILE" \
  pnpm exec tsx -e \
    "import('./src/cron/jobs/MarketingAutomationJob.ts').then(m=>(m.run||m.default?.run)()).catch(e=>{console.error(e);process.exit(1)})" \
    2>&1 | tee "$LOGFILE"

else
  echo "⚠️ MarketingAutomationJob.ts was not found from this shell."
  echo
  echo "Campaign was still created successfully:"
  echo "$CAMPAIGN_FILE"
  echo
  echo "Search it with:"
  echo "find /mnt/deepa/sohamyoga /app -path '*MarketingAutomationJob.ts' 2>/dev/null"
  exit 2
fi

echo
echo "============================================================"
echo "CAMPAIGN RUN COMPLETE"
echo "============================================================"
echo "Campaign: $CAMPAIGN_FILE"
echo "Log:      $LOGFILE"
echo
echo "Important:"
echo "Actual publication still requires a connected Facebook Page"
echo "and valid Page authorization inside Postiz/Meta."
echo "============================================================"
