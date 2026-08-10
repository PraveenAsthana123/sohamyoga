#!/usr/bin/env bash
set -euo pipefail

# Interactive, local-only onboarding for SohamYoga/Postiz developer applications.
# It cannot accept legal terms, solve CAPTCHA, pass identity review, or create
# third-party accounts. It generates the exact data needed and stores secrets
# in a permission-0600 file without printing them.

CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/sohamyoga"
ENV_FILE="$CONFIG_DIR/social-integrations.env"
META_FILE="$CONFIG_DIR/social-integrations.info"
PORTS_FILE="$CONFIG_DIR/ports.env"
ROOT="/mnt/deepa/sohamyoga"

declare -a PROVIDERS=(facebook youtube linkedin tiktok x pinterest reddit discord telegram bluesky)
declare -A LABEL PORTAL ID_VAR SECRET_VAR CALLBACK REVIEW SINGLE_SECRET
LABEL[facebook]='Facebook + Instagram + Threads'; PORTAL[facebook]='https://developers.facebook.com/apps/'; ID_VAR[facebook]='FACEBOOK_APP_ID'; SECRET_VAR[facebook]='FACEBOOK_APP_SECRET'; CALLBACK[facebook]='/api/socials/facebook/callback'; REVIEW[facebook]='Meta business verification/app review usually required'
LABEL[youtube]='YouTube'; PORTAL[youtube]='https://console.cloud.google.com/apis/credentials'; ID_VAR[youtube]='YOUTUBE_CLIENT_ID'; SECRET_VAR[youtube]='YOUTUBE_CLIENT_SECRET'; CALLBACK[youtube]='/api/socials/youtube/callback'; REVIEW[youtube]='Enable YouTube Data API v3 and configure OAuth consent'
LABEL[linkedin]='LinkedIn'; PORTAL[linkedin]='https://www.linkedin.com/developers/apps'; ID_VAR[linkedin]='LINKEDIN_CLIENT_ID'; SECRET_VAR[linkedin]='LINKEDIN_CLIENT_SECRET'; CALLBACK[linkedin]='/api/socials/linkedin/callback'; REVIEW[linkedin]='Company Page association and sharing approval may be required'
LABEL[tiktok]='TikTok'; PORTAL[tiktok]='https://developers.tiktok.com/apps/'; ID_VAR[tiktok]='TIKTOK_CLIENT_ID'; SECRET_VAR[tiktok]='TIKTOK_CLIENT_SECRET'; CALLBACK[tiktok]='/api/socials/tiktok/callback'; REVIEW[tiktok]='Content Posting API review is required for public posting'
LABEL[x]='X'; PORTAL[x]='https://developer.x.com/en/portal/dashboard'; ID_VAR[x]='X_CLIENT_ID'; SECRET_VAR[x]='X_CLIENT_SECRET'; CALLBACK[x]='/api/socials/x/callback'; REVIEW[x]='Enable OAuth 2.0, write and offline scopes; API plan may be paid'
LABEL[pinterest]='Pinterest'; PORTAL[pinterest]='https://developers.pinterest.com/apps/'; ID_VAR[pinterest]='PINTEREST_CLIENT_ID'; SECRET_VAR[pinterest]='PINTEREST_CLIENT_SECRET'; CALLBACK[pinterest]='/api/socials/pinterest/callback'; REVIEW[pinterest]='Request boards and pins read/write permissions'
LABEL[reddit]='Reddit'; PORTAL[reddit]='https://www.reddit.com/prefs/apps'; ID_VAR[reddit]='REDDIT_CLIENT_ID'; SECRET_VAR[reddit]='REDDIT_CLIENT_SECRET'; CALLBACK[reddit]='/api/socials/reddit/callback'; REVIEW[reddit]='Create a web app and follow current API access rules'
LABEL[discord]='Discord'; PORTAL[discord]='https://discord.com/developers/applications'; ID_VAR[discord]='DISCORD_CLIENT_ID'; SECRET_VAR[discord]='DISCORD_CLIENT_SECRET'; CALLBACK[discord]='/api/socials/discord/callback'; REVIEW[discord]='Create an application and bot or use a channel webhook'
LABEL[telegram]='Telegram'; PORTAL[telegram]='https://t.me/BotFather'; ID_VAR[telegram]='TELEGRAM_BOT_TOKEN'; SECRET_VAR[telegram]=''; CALLBACK[telegram]=''; REVIEW[telegram]='Create with @BotFather and make the bot a channel administrator'
LABEL[bluesky]='Bluesky'; PORTAL[bluesky]='https://bsky.app/settings/app-passwords'; ID_VAR[bluesky]='BLUESKY_APP_PASSWORD'; SECRET_VAR[bluesky]=''; CALLBACK[bluesky]=''; REVIEW[bluesky]='Use an app password, never the main account password'
SINGLE_SECRET[telegram]=1; SINGLE_SECRET[bluesky]=1

say(){ printf '%s\n' "$*"; }
prompt_required(){ local __name="$1" __prompt="$2" value=''; while [[ -z "$value" ]]; do read -r -p "$__prompt: " value; done; printf -v "$__name" '%s' "$value"; }
env_quote(){ printf "'%s'" "${1//\'/\'\\\'\'}"; }
valid_email(){ [[ "$1" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; }
valid_base(){ [[ "$1" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?$ || "$1" =~ ^http://(127\.0\.0\.1|localhost)(:[0-9]+)?$ ]]; }
selected(){ [[ " $SELECTED " == *" $1 "* ]]; }

say 'SohamYoga unified social developer-app setup'
say 'This creates local configuration and instructions; third-party verification remains manual.'
say 'Do not paste social-account passwords, recovery codes, payment details, or access tokens.'
say ''

prompt_required ORG_NAME 'Organization/legal business name'
while :; do prompt_required SERVICE_EMAIL 'Company-controlled service email'; valid_email "$SERVICE_EMAIL" && break; say 'Invalid email format. Try again.'; SERVICE_EMAIL=''; done
while :; do prompt_required PUBLIC_BASE 'Public HTTPS base URL (or http://localhost:PORT for development)'; PUBLIC_BASE="${PUBLIC_BASE%/}"; valid_base "$PUBLIC_BASE" && break; say 'Use https://domain.example or http://localhost:PORT.'; PUBLIC_BASE=''; done
read -r -p 'Privacy policy URL (Enter uses BASE/privacy): ' PRIVACY_URL; PRIVACY_URL="${PRIVACY_URL:-$PUBLIC_BASE/privacy}"
read -r -p 'Terms URL (Enter uses BASE/terms): ' TERMS_URL; TERMS_URL="${TERMS_URL:-$PUBLIC_BASE/terms}"
read -r -p 'Data-deletion URL (Enter uses BASE/data-deletion): ' DELETE_URL; DELETE_URL="${DELETE_URL:-$PUBLIC_BASE/data-deletion}"
say 'Providers: facebook youtube linkedin tiktok x pinterest reddit discord telegram bluesky'
read -r -p 'Providers to configure [all]: ' SELECTED; SELECTED="${SELECTED:-all}"; [[ "$SELECTED" == all ]] && SELECTED="${PROVIDERS[*]}"
for p in $SELECTED; do [[ -n "${LABEL[$p]:-}" ]] || { say "Unknown provider: $p"; exit 2; }; done

mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"
if [[ -f "$ENV_FILE" ]]; then backup="$ENV_FILE.backup.$(date +%Y%m%d%H%M%S)"; cp -p "$ENV_FILE" "$backup"; say "Existing credential file backed up to $backup"; fi
umask 077
tmp_env=$(mktemp "$CONFIG_DIR/.social-env.XXXXXX")
tmp_info=$(mktemp "$CONFIG_DIR/.social-info.XXXXXX")
trap 'rm -f "${tmp_env:-}" "${tmp_info:-}"' EXIT
{
 say '# Generated by setup-social-developer-apps.sh; secrets must never be committed.'
 printf 'SOHAM_SOCIAL_ORG=%s\n' "$(env_quote "$ORG_NAME")"
 printf 'SOHAM_SOCIAL_SERVICE_EMAIL=%s\n' "$(env_quote "$SERVICE_EMAIL")"
 printf 'POSTIZ_CLIENT_URL=%s\n' "$(env_quote "$PUBLIC_BASE")"
 printf 'NEXT_PUBLIC_BACKEND_URL=%s\n' "$(env_quote "$PUBLIC_BASE")"
 printf 'SOHAM_PRIVACY_URL=%s\n' "$(env_quote "$PRIVACY_URL")"
 printf 'SOHAM_TERMS_URL=%s\n' "$(env_quote "$TERMS_URL")"
 printf 'SOHAM_DATA_DELETION_URL=%s\n' "$(env_quote "$DELETE_URL")"
} > "$tmp_env"
{
 say "Organization: $ORG_NAME"; say "Service email: $SERVICE_EMAIL"; say "Public base: $PUBLIC_BASE"; say ''
} > "$tmp_info"

read -r -p 'Open official developer portals now? [y/N]: ' OPEN_PORTALS
configured=0; skipped=0
for p in $SELECTED; do
 say ''; say "=== ${LABEL[$p]} ==="; say "Portal: ${PORTAL[$p]}"; say "Requirement: ${REVIEW[$p]}"
 [[ -n "${CALLBACK[$p]}" ]] && say "Authorized callback: $PUBLIC_BASE${CALLBACK[$p]}"
 printf '%s | %s | %s\n' "$p" "${PORTAL[$p]}" "${CALLBACK[$p]:+$PUBLIC_BASE${CALLBACK[$p]}}" >> "$tmp_info"
 if [[ "$OPEN_PORTALS" =~ ^[Yy]$ ]] && command -v xdg-open >/dev/null; then xdg-open "${PORTAL[$p]}" >/dev/null 2>&1 || true; fi
 if [[ "${SINGLE_SECRET[$p]:-0}" == 1 ]]; then read -r -s -p "Enter ${ID_VAR[$p]} (hidden), or Enter to skip: " app_id; say ''; else read -r -p "Enter ${ID_VAR[$p]} now, or Enter to skip: " app_id; fi
 if [[ -z "$app_id" ]]; then skipped=$((skipped+1)); continue; fi
 printf '%s=%s\n' "${ID_VAR[$p]}" "$(env_quote "$app_id")" >> "$tmp_env"
 if [[ -n "${SECRET_VAR[$p]}" ]]; then
   read -r -s -p "Enter ${SECRET_VAR[$p]} (hidden), or Enter to leave partial: " app_secret; say ''
   [[ -n "$app_secret" ]] && printf '%s=%s\n' "${SECRET_VAR[$p]}" "$(env_quote "$app_secret")" >> "$tmp_env"
   [[ -n "$app_secret" ]] && configured=$((configured+1)) || skipped=$((skipped+1))
 else configured=$((configured+1)); fi
done

mv "$tmp_env" "$ENV_FILE"; mv "$tmp_info" "$META_FILE"; chmod 600 "$ENV_FILE" "$META_FILE"; trap - EXIT

# Register status only; credentials are never placed in SQL or command arguments.
if [[ -f "$CONFIG_DIR/runtime.env" ]]; then set -a; source "$CONFIG_DIR/runtime.env"; set +a; fi
if command -v psql >/dev/null && [[ -n "${DATABASE_URL:-}" ]]; then
 for p in $SELECTED; do
  state=not_configured; source "$ENV_FILE"; id_name="${ID_VAR[$p]}"; secret_name="${SECRET_VAR[$p]}"
  [[ -n "${!id_name:-}" ]] && state=partial
  [[ -n "${!id_name:-}" && ( -z "$secret_name" || -n "${!secret_name:-}" ) ]] && state=configured
  psql "$DATABASE_URL" -X -q -v key="$p" -v label="${LABEL[$p]}" -v state="$state" -v endpoint="${PORTAL[$p]}" <<'SQL' || true
INSERT INTO integration_master(integration_key,name,install_status,config_status,runtime_status,endpoint,enabled,requires_credentials,last_checked_at,notes)
VALUES(:'key',:'label','installed',:'state','not_verified',:'endpoint',TRUE,(:'state'<>'configured'),now(),'Developer app metadata registered by interactive CLI; no secrets stored here')
ON CONFLICT(integration_key) DO UPDATE SET config_status=EXCLUDED.config_status,requires_credentials=EXCLUDED.requires_credentials,endpoint=EXCLUDED.endpoint,last_checked_at=now(),updated_at=now();
SQL
 done
fi

say ''; say 'Configuration check (values are never printed):'
set +e; bash "$ROOT/slp-frontend/downloads/scripts/validate-postiz-providers.sh" "$ENV_FILE"; validate_code=$?; set -e
say ''; say "Protected credentials: $ENV_FILE"; say "Non-secret checklist: $META_FILE"; say "Configured now: $configured | skipped/partial: $skipped"
say "Portal setup UI: http://127.0.0.1:$(awk -F= '$1==\"SOHAM_FRONTEND_PORT\"{print $2}' "$PORTS_FILE" 2>/dev/null || echo 8085)/admin/social/setup"
say 'Next: finish platform verification, then connect each tenant account using OAuth. Never enter social passwords in this file.'
if selected facebook && [[ -x "$ROOT/scripts/setup-meta-publishing-runtime.sh" ]]; then
 read -r -p 'Apply Facebook credentials to the local Postiz runtime now? [Y/n]: ' APPLY_META
 if [[ ! "$APPLY_META" =~ ^[Nn]$ ]]; then bash "$ROOT/scripts/setup-meta-publishing-runtime.sh" || say 'Meta runtime needs attention; run setup-meta-publishing-runtime.sh again.'; fi
fi
[[ "$skipped" -eq 0 ]] && exit 0
exit "$validate_code"
