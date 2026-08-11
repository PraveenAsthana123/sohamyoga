#!/usr/bin/env bash
# Manual terminal helper for connecting a social provider through Postiz.
#
# Real data only: provider setup URLs and required env vars are duplicated
# from src/cron/jobs/PostizProviderHealthJob.ts's PROVIDERS array (the
# actual job that checks these at runtime) — keep both in sync if either
# changes. Live "configured" status below is read straight from Postgres
# (postiz_provider_status), i.e. whatever the last real
# postiz-provider-health cron run actually found, not a guess.
#
# Usage:
#   bash scripts/social-provider-setup.sh              # list all providers + status
#   bash scripts/social-provider-setup.sh tumblr        # setup guidance for one provider
set -euo pipefail

DB_CONTAINER="${DB_CONTAINER:-sohamyoga-postgres}"
DB_USER="${POSTGRES_USER:-sohamyoga}"
DB_NAME="${POSTGRES_DB:-sohamyoga}"

# name|env_var_1,env_var_2 (empty = no developer app needed)|setup_url
PROVIDERS=(
  "Telegram|TELEGRAM_BOT_TOKEN|Open Telegram -> @BotFather -> /newbot"
  "Discord|DISCORD_CLIENT_ID,DISCORD_CLIENT_SECRET|discord.com/developers/applications"
  "Bluesky|BLUESKY_APP_PASSWORD|bsky.app Settings -> App Passwords"
  "Reddit|REDDIT_CLIENT_ID,REDDIT_CLIENT_SECRET|reddit.com/prefs/apps -> web app"
  "YouTube|YOUTUBE_CLIENT_ID,YOUTUBE_CLIENT_SECRET|console.cloud.google.com -> YouTube Data API v3"
  "Facebook|FACEBOOK_APP_ID,FACEBOOK_APP_SECRET|developers.facebook.com -> Business App"
  "Instagram|FACEBOOK_APP_ID,FACEBOOK_APP_SECRET|Same app as Facebook -> add Instagram Graph API product"
  "Threads|THREADS_APP_ID,THREADS_APP_SECRET|Same Meta app -> add Threads API product"
  "LinkedIn|LINKEDIN_CLIENT_ID,LINKEDIN_CLIENT_SECRET|linkedin.com/developers -> Share on LinkedIn"
  "X|X_CLIENT_ID,X_CLIENT_SECRET|developer.twitter.com -> New Project + App"
  "TikTok|TIKTOK_CLIENT_ID,TIKTOK_CLIENT_SECRET|developers.tiktok.com -> Content Posting API"
  "Pinterest|PINTEREST_CLIENT_ID,PINTEREST_CLIENT_SECRET|developers.pinterest.com"
  "Mastodon|MASTODON_CLIENT_ID,MASTODON_CLIENT_SECRET|YOUR_INSTANCE/settings/applications"
  "Tumblr|TUMBLR_CLIENT_ID,TUMBLR_CLIENT_SECRET|tumblr.com/oauth/apps"
  "Dribbble|DRIBBBLE_CLIENT_ID,DRIBBBLE_CLIENT_SECRET|dribbble.com/account/applications/new"
  "Medium||No developer app needed -- connect the account directly in the Postiz UI (http://127.0.0.1:15080)"
  "Twitch||No developer app needed -- connect the account directly in the Postiz UI (http://127.0.0.1:15080)"
)

RUNTIME_ENV="$HOME/.config/sohamyoga/runtime.env"
[[ -f "$RUNTIME_ENV" ]] && set -a && source "$RUNTIME_ENV" && set +a

db_status() {
  local name="$1"
  docker exec "$DB_CONTAINER" psql -X -U "$DB_USER" -d "$DB_NAME" -Atc \
    "SELECT CASE WHEN is_configured THEN 'configured' ELSE 'not connected' END
     FROM postiz_provider_status WHERE provider_name = '${name}'" 2>/dev/null || echo "unknown (no DB row yet)"
}

show_provider() {
  local entry="$1"
  IFS='|' read -r name vars setup_url <<< "$entry"
  local status
  status="$(db_status "$name")"

  echo "── ${name} ────────────────────────────────────────"
  echo "  DB status (last postiz-provider-health run): ${status}"
  if [[ -z "$vars" ]]; then
    echo "  Setup: ${setup_url}"
  else
    echo "  Setup: ${setup_url}"
    IFS=',' read -ra var_list <<< "$vars"
    for v in "${var_list[@]}"; do
      if [[ -n "${!v:-}" ]]; then
        echo "  ${v}: set locally"
      else
        echo "  ${v}: NOT set (add to ${RUNTIME_ENV})"
      fi
    done
    echo "  After setting env vars, either restart the app or trigger the"
    echo "  'postiz-provider-health' job from the Demo Hub's Use Case Catalog"
    echo "  to refresh the DB status above."
  fi
  echo ""
}

if [[ $# -eq 0 ]]; then
  echo "17 real Postiz-supported providers (verified against gitroomhq/postiz-app source):"
  echo ""
  for entry in "${PROVIDERS[@]}"; do
    show_provider "$entry"
  done
else
  target="$1"
  found=0
  for entry in "${PROVIDERS[@]}"; do
    name="${entry%%|*}"
    if [[ "${name,,}" == "${target,,}" ]]; then
      show_provider "$entry"
      found=1
    fi
  done
  if [[ "$found" -eq 0 ]]; then
    echo "Unknown provider: ${target}"
    echo "Known: $(printf '%s, ' "${PROVIDERS[@]%%|*}" | sed 's/, $//')"
    exit 1
  fi
fi
