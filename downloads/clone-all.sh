#!/usr/bin/env bash
# SohamYoga — clone all open-source integration repos
# Run: bash clone-all.sh
# Each repo is cloned only if the folder doesn't already exist (idempotent).

set -euo pipefail

BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BASE"

clone_if_missing() {
  local dir="$1"
  local url="$2"
  local depth="${3:-1}"  # shallow clone by default
  if [ -d "$dir/.git" ]; then
    echo "  [skip] $dir already exists"
  else
    echo "  [clone] $url → $dir"
    git clone --depth "$depth" "$url" "$dir"
  fi
}

echo "=== SohamYoga: cloning integration dependencies ==="
echo ""

echo "--- 1. Frappe Framework + ERPNext (billing, HR, CRM) ---"
clone_if_missing frappe/frappe           https://github.com/frappe/frappe
clone_if_missing frappe/erpnext          https://github.com/frappe/erpnext
clone_if_missing frappe/education        https://github.com/frappe/education
clone_if_missing frappe/crm              https://github.com/frappe/crm
echo ""

echo "--- 2. Cal.com (booking calendar) ---"
clone_if_missing calcom                  https://github.com/calcom/cal.com
echo ""

echo "--- 3. Chatwoot (live chat) ---"
clone_if_missing chatwoot                https://github.com/chatwoot/chatwoot
echo ""

echo "--- 4. Keycloak (SSO / identity) ---"
# Keycloak is a compiled Java app; download release zip instead
KEYCLOAK_VERSION="24.0.4"
KEYCLOAK_DIR="keycloak"
if [ ! -d "$KEYCLOAK_DIR" ]; then
  echo "  [download] Keycloak $KEYCLOAK_VERSION"
  mkdir -p "$KEYCLOAK_DIR"
  curl -fsSL "https://github.com/keycloak/keycloak/releases/download/${KEYCLOAK_VERSION}/keycloak-${KEYCLOAK_VERSION}.zip" \
    -o "$KEYCLOAK_DIR/keycloak.zip"
  echo "  Keycloak zip downloaded. Unzip to use: unzip keycloak/keycloak.zip -d keycloak/"
else
  echo "  [skip] keycloak/ already exists"
fi
echo ""

echo "--- 5. PostHog (analytics) ---"
clone_if_missing posthog                 https://github.com/PostHog/posthog
echo ""

echo "--- 6. Listmonk (newsletter / email campaigns) ---"
# Listmonk is a Go binary; just grab the docker-compose
LISTMONK_DIR="listmonk"
if [ ! -d "$LISTMONK_DIR" ]; then
  mkdir -p "$LISTMONK_DIR"
  curl -fsSL https://raw.githubusercontent.com/knadh/listmonk/master/docker-compose.yml \
    -o "$LISTMONK_DIR/docker-compose.yml"
  echo "  Listmonk docker-compose.yml downloaded."
else
  echo "  [skip] listmonk/ already exists"
fi
echo ""

echo "--- 7. Formbricks (surveys / dosha quiz) ---"
clone_if_missing formbricks              https://github.com/formbricks/formbricks
echo ""

echo "--- 8. LiveKit (live streaming for online classes) ---"
clone_if_missing livekit                 https://github.com/livekit/livekit
echo ""

echo "--- 9. Ghost (Blog CMS) ---"
clone_if_missing ghost                   https://github.com/TryGhost/Ghost
echo ""

echo "==================================================="
echo "All integrations cloned to: $BASE"
echo ""
echo "Next steps:"
echo "  1. cd frappe && docker compose up  (start Frappe)"
echo "  2. cd calcom  && docker compose up  (start Cal.com)"
echo "  3. cd chatwoot && docker compose up (start Chatwoot)"
echo "  4. Configure .env files in each folder"
echo "  See /mnt/deepa/sohamyoga/integrations/ for adapter code"
