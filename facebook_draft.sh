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
