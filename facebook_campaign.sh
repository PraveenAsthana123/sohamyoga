#!/usr/bin/env bash
set -euo pipefail

ROOT="/mnt/deepa/sohamyoga"
CAMPAIGN_DIR="$ROOT/campaigns"
LOG_DIR="$ROOT/logs/facebook-campaigns"

BACKEND="http://127.0.0.1:15070"
POSTIZ="http://127.0.0.1:15080"
FRONTEND="http://127.0.0.1:8085"

mkdir -p "$CAMPAIGN_DIR" "$LOG_DIR"

echo "============================================================"
echo "           SOHAMYOGA FACEBOOK CAMPAIGN"
echo "============================================================"
echo

# ------------------------------------------------------------
# 1. HEALTH CHECK
# ------------------------------------------------------------

echo "1. SERVICE HEALTH"
echo "------------------------------------------------------------"

BACKEND_CODE="$(curl -s -o /dev/null -w '%{http_code}' \
    --max-time 5 "$BACKEND/api/health" 2>/dev/null || true)"

POSTIZ_CODE="$(curl -s -o /dev/null -w '%{http_code}' \
    --max-time 5 "$POSTIZ" 2>/dev/null || true)"

FRONTEND_CODE="$(curl -s -o /dev/null -w '%{http_code}' \
    --max-time 5 "$FRONTEND" 2>/dev/null || true)"

echo "Backend  : ${BACKEND_CODE:-DOWN}"
echo "Postiz   : ${POSTIZ_CODE:-DOWN}"
echo "Frontend : ${FRONTEND_CODE:-DOWN}"

if [[ "$BACKEND_CODE" != "200" ]]; then
    echo "❌ Backend is unavailable."
    exit 1
fi

if [[ -z "$POSTIZ_CODE" || "$POSTIZ_CODE" == "000" ]]; then
    echo "❌ Postiz is unavailable."
    exit 1
fi

if [[ -z "$FRONTEND_CODE" || "$FRONTEND_CODE" == "000" ]]; then
    echo "❌ Frontend is unavailable."
    exit 1
fi

echo "✅ Services available"

# ------------------------------------------------------------
# 2. MODE
# ------------------------------------------------------------

echo
echo "2. CAMPAIGN MODE"
echo "------------------------------------------------------------"
echo
echo "1 = Draft only"
echo "2 = Schedule"
echo "3 = Publish now"
echo

read -rp "Choose [1/2/3]: " MODE

case "$MODE" in
    1)
        MODE_NAME="draft"
        ;;
    2)
        MODE_NAME="schedule"
        ;;
    3)
        MODE_NAME="publish"
        ;;
    *)
        echo "❌ Invalid option."
        exit 1
        ;;
esac

# ------------------------------------------------------------
# 3. CAMPAIGN DETAILS
# ------------------------------------------------------------

echo
echo "3. CAMPAIGN DETAILS"
echo "------------------------------------------------------------"

read -rp "Campaign name: " CAMPAIGN

if [[ -z "$CAMPAIGN" ]]; then
    echo "❌ Campaign name is required."
    exit 1
fi

read -rp "Facebook Page name [Soham Yoga]: " PAGE
PAGE="${PAGE:-Soham Yoga}"

echo
echo "Enter Facebook post text."
echo "Press ENTER on an empty line when finished."
echo

TEXT=""

while IFS= read -r LINE; do
    [[ -z "$LINE" ]] && break
    TEXT+="$LINE"$'\n'
done

TEXT="${TEXT%$'\n'}"

if [[ -z "$TEXT" ]]; then
    echo "❌ Post text is required."
    exit 1
fi

# ------------------------------------------------------------
# 4. MEDIA
# ------------------------------------------------------------

echo
echo "4. MEDIA"
echo "------------------------------------------------------------"
echo "Press ENTER for text-only."
echo "You may also type: none, skip, no"
echo

read -rp "Image/video path: " MEDIA

LOWER_MEDIA="$(printf '%s' "$MEDIA" | tr '[:upper:]' '[:lower:]')"

case "$LOWER_MEDIA" in
    ""|none|skip|no|n|text|text-only)
        MEDIA=""
        ;;
    *)
        if [[ ! -f "$MEDIA" ]]; then
            echo
            echo "⚠️ File not found:"
            echo "$MEDIA"
            echo
            read -rp "Continue as text-only? [Y/n]: " ANSWER
            ANSWER="${ANSWER:-Y}"

            case "$ANSWER" in
                Y|y|YES|yes)
                    MEDIA=""
                    ;;
                *)
                    echo "Cancelled."
                    exit 1
                    ;;
            esac
        fi
        ;;
esac

# ------------------------------------------------------------
# 5. SCHEDULE
# ------------------------------------------------------------

SCHEDULE_AT=""

if [[ "$MODE" == "2" ]]; then
    echo
    echo "5. SCHEDULE"
    echo "------------------------------------------------------------"
    echo "Example:"
    echo "2026-08-10T09:00:00-06:00"
    echo

    read -rp "Schedule date/time: " SCHEDULE_AT

    if [[ -z "$SCHEDULE_AT" ]]; then
        echo "❌ Schedule date/time is required."
        exit 1
    fi
fi

# ------------------------------------------------------------
# 6. PREVIEW
# ------------------------------------------------------------

echo
echo "============================================================"
echo "                    CAMPAIGN PREVIEW"
echo "============================================================"
echo "Mode     : $MODE_NAME"
echo "Campaign : $CAMPAIGN"
echo "Page     : $PAGE"
echo "Media    : ${MEDIA:-Text only}"

if [[ "$MODE" == "2" ]]; then
    echo "Schedule : $SCHEDULE_AT"
fi

echo
echo "Post:"
echo "------------------------------------------------------------"
printf '%s\n' "$TEXT"
echo "------------------------------------------------------------"

# ------------------------------------------------------------
# 7. CREATE JSON
# ------------------------------------------------------------

SAFE_NAME="$(
    printf '%s' "$CAMPAIGN" |
    tr '[:upper:]' '[:lower:]' |
    sed 's/[^a-z0-9]/-/g' |
    sed 's/--*/-/g' |
    sed 's/^-//' |
    sed 's/-$//'
)"

STAMP="$(date '+%Y%m%d-%H%M%S')"
CAMPAIGN_FILE="$CAMPAIGN_DIR/${STAMP}-${SAFE_NAME}.json"

python3 - \
    "$CAMPAIGN_FILE" \
    "$CAMPAIGN" \
    "$PAGE" \
    "$TEXT" \
    "$MEDIA" \
    "$MODE_NAME" \
    "$SCHEDULE_AT" <<'PY'
import json
import sys
from datetime import datetime, timezone

(
    filename,
    campaign,
    page,
    text,
    media,
    mode,
    schedule
) = sys.argv[1:]

data = {
    "campaignName": campaign,
    "platform": "facebook",
    "pageName": page,
    "postText": text,
    "mediaPath": media or None,
    "publishMode": mode,
    "scheduleAt": schedule or None,
    "approvalRequired": mode != "draft",
    "status": "draft" if mode == "draft" else "pending",
    "createdAt": datetime.now(timezone.utc).isoformat(),
    "retry": {
        "maxAttempts": 3,
        "backoffSeconds": [30, 120, 300]
    }
}

with open(filename, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)

print(filename)
PY

echo
echo "✅ Campaign file created:"
echo "$CAMPAIGN_FILE"

# ------------------------------------------------------------
# 8. DRAFT STOPS HERE
# ------------------------------------------------------------

if [[ "$MODE" == "1" ]]; then
    echo
    echo "============================================================"
    echo "✅ DRAFT CREATED SUCCESSFULLY"
    echo "============================================================"
    echo
    echo "Nothing was published to Facebook."
    echo
    echo "File:"
    echo "$CAMPAIGN_FILE"
    exit 0
fi

# ------------------------------------------------------------
# 9. EXTERNAL ACTION CONFIRMATION
# ------------------------------------------------------------

echo
echo "============================================================"

if [[ "$MODE" == "2" ]]; then
    echo "This will attempt to SCHEDULE the Facebook campaign."
    read -rp "Type SCHEDULE to continue: " CONFIRM

    if [[ "$CONFIRM" != "SCHEDULE" ]]; then
        echo "Cancelled. Campaign remains saved."
        exit 0
    fi
else
    echo "This may create an externally visible Facebook post."
    read -rp "Type PUBLISH to continue: " CONFIRM

    if [[ "$CONFIRM" != "PUBLISH" ]]; then
        echo "Cancelled. Campaign remains saved."
        exit 0
    fi
fi

# ------------------------------------------------------------
# 10. FIND EXISTING MARKETING JOB
# ------------------------------------------------------------

echo
echo "10. MARKETING AUTOMATION"
echo "------------------------------------------------------------"

JOB="$(
    find "$ROOT" \
        -path '*/src/cron/jobs/MarketingAutomationJob.ts' \
        -not -path '*/node_modules/*' \
        2>/dev/null |
    head -1
)"

if [[ -z "$JOB" ]]; then
    echo "⚠️ MarketingAutomationJob.ts was not found."
    echo
    echo "Campaign is saved but was NOT submitted."
    echo "$CAMPAIGN_FILE"
    exit 2
fi

echo "Marketing job:"
echo "$JOB"

JOB_DIR="$(dirname "$(dirname "$(dirname "$(dirname "$JOB")")")")"

LOG="$LOG_DIR/${STAMP}-${SAFE_NAME}.log"

echo
echo "Submitting campaign..."
echo

cd "$JOB_DIR"

CAMPAIGN_FILE="$CAMPAIGN_FILE" \
FACEBOOK_CAMPAIGN_FILE="$CAMPAIGN_FILE" \
pnpm exec tsx -e \
"import('./src/cron/jobs/MarketingAutomationJob.ts')
.then(m => (m.run || m.default?.run)())
.catch(e => { console.error(e); process.exit(1); })" \
2>&1 | tee "$LOG"

echo
echo "============================================================"
echo "             CAMPAIGN EXECUTION COMPLETE"
echo "============================================================"
echo "Campaign file: $CAMPAIGN_FILE"
echo "Log file     : $LOG"
echo "============================================================"
