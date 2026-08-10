#!/usr/bin/env bash
set -e

ROOT="/mnt/deepa/sohamyoga"

media_input() {
  :
}

cat > "$ROOT/facebook_draft.sh" <<'DRAFT'
#!/usr/bin/env bash
set -e

ROOT="/mnt/deepa/sohamyoga"

normalize_media() {
    local media="$1"
    local low
    low="$(printf '%s' "$media" | tr '[:upper:]' '[:lower:]')"

    case "$low" in
        ""|none|no|n|skip|text|text-only|textonly)
            echo ""
            return 0
            ;;
    esac

    if [[ -f "$media" ]]; then
        echo "$media"
        return 0
    fi

    echo
    echo "⚠️ '$media' is not an existing file."
    read -rp "Continue as TEXT-ONLY? [Y/n]: " answer
    answer="${answer:-Y}"

    case "$answer" in
        Y|y|YES|yes)
            echo ""
            ;;
        *)
            echo "__INVALID__"
            ;;
    esac
}

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
read -rp "Image/video path [ENTER/none = text-only]: " RAW_MEDIA

MEDIA="$(normalize_media "$RAW_MEDIA")"

if [[ "$MEDIA" == "__INVALID__" ]]; then
    echo "❌ Draft cancelled."
    exit 1
fi

echo
echo "------------------------------------------------------------"
echo "DRAFT PREVIEW"
echo "------------------------------------------------------------"
echo "Campaign : $CAMPAIGN"
echo "Page     : $PAGE"
echo "Media    : ${MEDIA:-Text only}"
echo
echo "Post:"
printf '%s\n' "$TEXT"
echo "------------------------------------------------------------"

printf '%s\n' \
"$CAMPAIGN" \
"$PAGE" \
"$TEXT" \
"" \
"$MEDIA" \
"1" \
| "$ROOT/run_facebook_campaign.sh"
DRAFT


cat > "$ROOT/facebook_schedule.sh" <<'SCHEDULE'
#!/usr/bin/env bash
set -e

ROOT="/mnt/deepa/sohamyoga"

normalize_media() {
    local media="$1"
    local low
    low="$(printf '%s' "$media" | tr '[:upper:]' '[:lower:]')"

    case "$low" in
        ""|none|no|n|skip|text|text-only|textonly)
            echo ""
            return 0
            ;;
    esac

    if [[ -f "$media" ]]; then
        echo "$media"
        return 0
    fi

    echo
    echo "⚠️ '$media' is not an existing file."
    read -rp "Continue as TEXT-ONLY? [Y/n]: " answer
    answer="${answer:-Y}"

    case "$answer" in
        Y|y|YES|yes)
            echo ""
            ;;
        *)
            echo "__INVALID__"
            ;;
    esac
}

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
read -rp "Image/video path [ENTER/none = text-only]: " RAW_MEDIA

MEDIA="$(normalize_media "$RAW_MEDIA")"

if [[ "$MEDIA" == "__INVALID__" ]]; then
    echo "❌ Schedule cancelled."
    exit 1
fi

echo
echo "Example:"
echo "2026-08-10T09:00:00-06:00"
echo

read -rp "Schedule date/time: " WHEN

if [[ -z "$WHEN" ]]; then
    echo "❌ Schedule date/time is required."
    exit 1
fi

echo
echo "------------------------------------------------------------"
echo "SCHEDULE PREVIEW"
echo "------------------------------------------------------------"
echo "Campaign : $CAMPAIGN"
echo "Page     : $PAGE"
echo "When     : $WHEN"
echo "Media    : ${MEDIA:-Text only}"
echo
echo "Post:"
printf '%s\n' "$TEXT"
echo "------------------------------------------------------------"

read -rp "Schedule campaign? Type YES: " CONFIRM

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


cat > "$ROOT/facebook_publish_now.sh" <<'PUBLISH'
#!/usr/bin/env bash
set -e

ROOT="/mnt/deepa/sohamyoga"

normalize_media() {
    local media="$1"
    local low
    low="$(printf '%s' "$media" | tr '[:upper:]' '[:lower:]')"

    case "$low" in
        ""|none|no|n|skip|text|text-only|textonly)
            echo ""
            return 0
            ;;
    esac

    if [[ -f "$media" ]]; then
        echo "$media"
        return 0
    fi

    echo
    echo "⚠️ '$media' is not an existing file."
    read -rp "Continue as TEXT-ONLY? [Y/n]: " answer
    answer="${answer:-Y}"

    case "$answer" in
        Y|y|YES|yes)
            echo ""
            ;;
        *)
            echo "__INVALID__"
            ;;
    esac
}

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
read -rp "Image/video path [ENTER/none = text-only]: " RAW_MEDIA

MEDIA="$(normalize_media "$RAW_MEDIA")"

if [[ "$MEDIA" == "__INVALID__" ]]; then
    echo "❌ Publication cancelled."
    exit 1
fi

echo
echo "============================================================"
echo "               FINAL PUBLISH PREVIEW"
echo "============================================================"
echo "Campaign : $CAMPAIGN"
echo "Page     : $PAGE"
echo "Media    : ${MEDIA:-Text only}"
echo
echo "Post:"
echo "------------------------------------------------------------"
printf '%s\n' "$TEXT"
echo "------------------------------------------------------------"
echo
echo "⚠️ This may create an externally visible Facebook post."
echo

read -rp "Publish now? Type PUBLISH: " CONFIRM

if [[ "$CONFIRM" != "PUBLISH" ]]; then
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


chmod +x \
"$ROOT/facebook_draft.sh" \
"$ROOT/facebook_schedule.sh" \
"$ROOT/facebook_publish_now.sh"

echo
echo "✅ Scripts updated."
echo
echo "Draft:"
echo "  ./facebook_draft.sh"
echo
echo "Schedule:"
echo "  ./facebook_schedule.sh"
echo
echo "Publish:"
echo "  ./facebook_publish_now.sh"
