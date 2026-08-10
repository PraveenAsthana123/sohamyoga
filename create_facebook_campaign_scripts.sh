#!/usr/bin/env bash
set -e

ROOT="/mnt/deepa/sohamyoga"

# ============================================================
# 1. DRAFT SCRIPT
# ============================================================

cat > "$ROOT/facebook_draft.sh" <<'DRAFT'
#!/usr/bin/env bash
set -e

ROOT="/mnt/deepa/sohamyoga"

echo "============================================================"
echo "              FACEBOOK - CREATE DRAFT"
echo "============================================================"

read -rp "Campaign name: " CAMPAIGN
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

echo
read -rp "Image/video full path (ENTER for text-only): " MEDIA

if [[ -n "$MEDIA" && ! -f "$MEDIA" ]]; then
    echo
    echo "❌ Media file does not exist:"
    echo "$MEDIA"
    exit 1
fi

printf '%s\n' \
"$CAMPAIGN" \
"$PAGE" \
"$TEXT" \
"" \
"$MEDIA" \
"1" \
| "$ROOT/run_facebook_campaign.sh"
DRAFT

# ============================================================
# 2. SCHEDULE SCRIPT
# ============================================================

cat > "$ROOT/facebook_schedule.sh" <<'SCHEDULE'
#!/usr/bin/env bash
set -e

ROOT="/mnt/deepa/sohamyoga"

echo "============================================================"
echo "             FACEBOOK - SCHEDULE CAMPAIGN"
echo "============================================================"

read -rp "Campaign name: " CAMPAIGN
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

echo
read -rp "Image/video full path (ENTER for text-only): " MEDIA

if [[ -n "$MEDIA" && ! -f "$MEDIA" ]]; then
    echo
    echo "❌ Media file does not exist:"
    echo "$MEDIA"
    exit 1
fi

echo
echo "Examples:"
echo "2026-08-10T09:00:00-06:00"
echo "2026-08-15T18:00:00-06:00"
echo

read -rp "Schedule date/time: " WHEN

if [[ -z "$WHEN" ]]; then
    echo "❌ Schedule time is required."
    exit 1
fi

echo
echo "------------------------------------------------------------"
echo "FINAL SCHEDULE CONFIRMATION"
echo "------------------------------------------------------------"
echo "Campaign : $CAMPAIGN"
echo "Page     : $PAGE"
echo "Schedule : $WHEN"
echo "Media    : ${MEDIA:-None}"
echo

read -rp "Schedule this Facebook campaign? Type YES: " CONFIRM

if [[ "$CONFIRM" != "YES" ]]; then
    echo "Cancelled."
    exit 0
fi

printf '%s\n' \
"$CAMPAIGN" \
"$PAGE" \
"$TEXT" \
"" \
"$MEDIA" \
"2" \
"$WHEN" \
"yes" \
| "$ROOT/run_facebook_campaign.sh"
SCHEDULE

# ============================================================
# 3. PUBLISH-NOW SCRIPT
# ============================================================

cat > "$ROOT/facebook_publish_now.sh" <<'PUBLISH'
#!/usr/bin/env bash
set -e

ROOT="/mnt/deepa/sohamyoga"

echo "============================================================"
echo "               FACEBOOK - PUBLISH NOW"
echo "============================================================"

read -rp "Campaign name: " CAMPAIGN
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

echo
read -rp "Image/video full path (ENTER for text-only): " MEDIA

if [[ -n "$MEDIA" && ! -f "$MEDIA" ]]; then
    echo
    echo "❌ Media file does not exist:"
    echo "$MEDIA"
    exit 1
fi

echo
echo "============================================================"
echo "               FINAL PUBLISH CONFIRMATION"
echo "============================================================"
echo
echo "Campaign : $CAMPAIGN"
echo "Page     : $PAGE"
echo
echo "POST:"
echo "------------------------------------------------------------"
printf '%s\n' "$TEXT"
echo "------------------------------------------------------------"
echo
echo "Media: ${MEDIA:-None}"
echo
echo "⚠️ This option may create an externally visible Facebook post."
echo

read -rp "Publish now? Type PUBLISH: " CONFIRM

if [[ "$CONFIRM" != "PUBLISH" ]]; then
    echo
    echo "Publication cancelled."
    exit 0
fi

printf '%s\n' \
"$CAMPAIGN" \
"$PAGE" \
"$TEXT" \
"" \
"$MEDIA" \
"3" \
"yes" \
| "$ROOT/run_facebook_campaign.sh"
PUBLISH

# ============================================================
# 4. MEDIA FINDER
# ============================================================

cat > "$ROOT/facebook_find_media.sh" <<'MEDIA'
#!/usr/bin/env bash

echo "============================================================"
echo "             FACEBOOK - FIND IMAGE / VIDEO"
echo "============================================================"

find \
    /home/praveen/Pictures \
    /mnt/deepa/sohamyoga \
    -type f \
    \( \
      -iname "*.jpg" \
      -o -iname "*.jpeg" \
      -o -iname "*.png" \
      -o -iname "*.webp" \
      -o -iname "*.mp4" \
      -o -iname "*.mov" \
    \) \
    2>/dev/null |
    grep -v node_modules |
    head -100
MEDIA

chmod +x \
    "$ROOT/facebook_draft.sh" \
    "$ROOT/facebook_schedule.sh" \
    "$ROOT/facebook_publish_now.sh" \
    "$ROOT/facebook_find_media.sh"

echo
echo "============================================================"
echo "              FACEBOOK SCRIPTS CREATED"
echo "============================================================"
echo
echo "1. Draft:"
echo "   ./facebook_draft.sh"
echo
echo "2. Schedule:"
echo "   ./facebook_schedule.sh"
echo
echo "3. Publish now:"
echo "   ./facebook_publish_now.sh"
echo
echo "4. Find images/videos:"
echo "   ./facebook_find_media.sh"
echo
echo "============================================================"
