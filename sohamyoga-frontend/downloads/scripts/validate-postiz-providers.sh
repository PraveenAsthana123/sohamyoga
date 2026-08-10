#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Postiz Provider Validation Script
# Checks which social providers are configured in .env
# Does NOT print, log, or expose actual secret values
# Usage: bash downloads/scripts/validate-postiz-providers.sh [.env path]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ENV_FILE="${1:-.env}"

# Load env file (only check vars, never print values)
if [ -f "$ENV_FILE" ]; then
  set -o allexport
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +o allexport
else
  echo "WARNING: $ENV_FILE not found — checking environment variables only"
fi

PASS="✅"; FAIL="❌"; WARN="⚠️ "
CONFIGURED=0; MISSING=0; PARTIAL=0

check_pair() {
  local name="$1" var1="$2" var2="$3"
  local v1="${!var1:-}" v2="${!var2:-}"
  if [ -n "$v1" ] && [ -n "$v2" ]; then
    echo "$PASS  $name ($var1 + $var2)"
    CONFIGURED=$((CONFIGURED+1))
  elif [ -n "$v1" ] || [ -n "$v2" ]; then
    echo "$WARN  $name — PARTIAL: only one of $var1/$var2 set"
    PARTIAL=$((PARTIAL+1))
  else
    echo "$FAIL  $name — NOT CONFIGURED ($var1 + $var2 missing)"
    MISSING=$((MISSING+1))
  fi
}

check_single() {
  local name="$1" var="$2"
  local v="${!var:-}"
  if [ -n "$v" ]; then
    echo "$PASS  $name ($var)"
    CONFIGURED=$((CONFIGURED+1))
  else
    echo "$FAIL  $name — NOT CONFIGURED ($var missing)"
    MISSING=$((MISSING+1))
  fi
}

echo ""
echo "══════════════════════════════════════════════════════════"
echo " Postiz Social Provider Configuration Check"
echo " ENV FILE: $ENV_FILE"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "── Core ───────────────────────────────────────────────────"
check_single "Postiz URL"       "POSTIZ_CLIENT_URL"
check_single "Database"         "DATABASE_URL"
check_single "Redis"            "REDIS_URL"
check_single "JWT Secret"       "JWT_SECRET"

echo ""
echo "── Social Providers ───────────────────────────────────────"
check_pair  "Facebook Pages"   "FACEBOOK_APP_ID"       "FACEBOOK_APP_SECRET"
check_pair  "Instagram"        "FACEBOOK_APP_ID"       "FACEBOOK_APP_SECRET"
check_pair  "Threads"          "THREADS_APP_ID"        "THREADS_APP_SECRET"
check_pair  "LinkedIn"         "LINKEDIN_CLIENT_ID"    "LINKEDIN_CLIENT_SECRET"
check_pair  "X (Twitter)"      "X_CLIENT_ID"           "X_CLIENT_SECRET"
check_pair  "TikTok"           "TIKTOK_CLIENT_ID"      "TIKTOK_CLIENT_SECRET"
check_pair  "YouTube"          "YOUTUBE_CLIENT_ID"     "YOUTUBE_CLIENT_SECRET"
check_pair  "Pinterest"        "PINTEREST_CLIENT_ID"   "PINTEREST_CLIENT_SECRET"
check_pair  "Reddit"           "REDDIT_CLIENT_ID"      "REDDIT_CLIENT_SECRET"
check_single "Telegram"        "TELEGRAM_BOT_TOKEN"
check_pair  "Discord"          "DISCORD_CLIENT_ID"     "DISCORD_CLIENT_SECRET"
check_single "Bluesky"         "BLUESKY_APP_PASSWORD"
check_pair  "Mastodon"         "MASTODON_CLIENT_ID"    "MASTODON_CLIENT_SECRET"

echo ""
echo "── Integrations ───────────────────────────────────────────"
check_pair  "Nango OAuth"      "NANGO_SECRET_KEY"      "NANGO_PUBLIC_KEY"
check_single "OpenBao Secrets" "OPENBAO_ROOT_TOKEN"
check_single "Keycloak"        "KEYCLOAK_CLIENT_ID"

echo ""
echo "══════════════════════════════════════════════════════════"
echo " SUMMARY: $CONFIGURED configured | $PARTIAL partial | $MISSING missing"
echo "══════════════════════════════════════════════════════════"

if [ "$MISSING" -gt 0 ] || [ "$PARTIAL" -gt 0 ]; then
  echo ""
  echo " Next steps:"
  echo "  1. Run clone:  bash downloads/clone-integration-stack.sh"
  echo "  2. Fill .env:  cp downloads/postiz.env.example .env (then add values)"
  echo "  3. Run OpenBao seed: docker compose -f downloads/docker/openbao/docker-compose.openbao.yml run openbao-init"
  echo "  4. Start Postiz: docker compose -f downloads/docker/postiz/docker-compose.postiz.yml up -d"
  echo "  5. Connect accounts via Postiz UI: http://localhost:3000"
  echo ""
  echo "  Recommended order (simplest first):"
  echo "  Telegram → Discord → Bluesky → Reddit → YouTube → Facebook/Instagram → LinkedIn → X → TikTok"
  exit 1
else
  echo ""
  echo " All providers configured. Start Postiz and connect accounts via UI."
  exit 0
fi
