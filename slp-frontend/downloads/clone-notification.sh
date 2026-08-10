#!/usr/bin/env bash
# Clone script — Notification & Communication Center
# Run: bash downloads/clone-notification.sh
#
# Architecture: ALL notification state (templates, queue, history, preferences,
# analytics) lives in LOCAL Postgres. External providers only receive:
#   - rendered message text
#   - recipient address (email / phone / device token)
#   - OAuth / API token
# No customer profiles, names, or health data are ever sent to external services.
#
# Services:
#   Novu        — omnichannel orchestration (self-hosted)
#   Listmonk    — email campaigns and newsletters (self-hosted)
#   Postal      — transactional mail server (self-hosted)
#   ntfy        — push notifications (self-hosted)
#   Apprise     — multi-channel adapter (Telegram, Discord, Slack, ...)
#   Chatwoot    — already cloned in student module — skip if present

set -euo pipefail

DEST="${1:-downloads/repos}"
mkdir -p "$DEST"
cd "$DEST"

clone() {
  local url="$1"
  local dir="$2"
  if [ -d "$dir/.git" ]; then
    echo "[skip] $dir already exists"
  else
    echo "[clone] $dir"
    git clone --depth 1 "$url" "$dir"
  fi
}

echo "=== Notification & Communication Center — repo clone ==="

# ── 1. Novu (omnichannel notification orchestration) ─────────────────────────
clone "https://github.com/novuhq/novu.git" "novu"

# ── 2. Listmonk (email campaigns and newsletters) ────────────────────────────
clone "https://github.com/knadh/listmonk.git" "listmonk"

# ── 3. Postal (self-hosted transactional mail server) ────────────────────────
clone "https://github.com/postalserver/postal.git" "postal"

# ── 4. ntfy (self-hosted push notifications for web, Android, iOS) ───────────
clone "https://github.com/binwiederhier/ntfy.git" "ntfy"

# ── 5. Apprise (Python library — multi-channel adapter) ───────────────────────
clone "https://github.com/caronc/apprise.git" "apprise"

# ── 6. Chatwoot (in-app chat and support — skip if already cloned) ────────────
clone "https://github.com/chatwoot/chatwoot.git" "chatwoot"

# ── 7. Mautic (marketing automation — future use) ────────────────────────────
clone "https://github.com/mautic/mautic.git" "mautic"

echo ""
echo "=== Clone complete ==="
echo ""
echo "Deploy sequence (all self-hosted, all data stays local):"
echo ""
echo "1. Novu:"
echo "   cd $DEST/novu"
echo "   cp .env.example .env && edit .env (MONGO_URL, REDIS_URL, JWT_SECRET)"
echo "   docker compose up -d"
echo "   # Admin UI: http://localhost:3000"
echo ""
echo "2. Listmonk:"
echo "   cd $DEST/listmonk"
echo "   ./install.sh    # or docker compose up -d"
echo "   # Admin UI: http://localhost:9000"
echo ""
echo "3. Postal:"
echo "   cd $DEST/postal"
echo "   docker compose up -d"
echo "   # Requires MariaDB/MySQL; configure SMTP relay per docs"
echo ""
echo "4. ntfy:"
echo "   cd $DEST/ntfy"
echo "   docker run -p 80:80 -v ntfy_cache:/var/cache/ntfy binwiederhier/ntfy serve"
echo "   # Admin UI: http://localhost:80"
echo ""
echo "5. Apprise (Python adapter — no Docker needed):"
echo "   pip install apprise"
echo "   # Import in notification worker: from apprise import Apprise"
echo ""
echo "Data residency guarantee:"
echo "  - All templates, preferences, queue records, and analytics: LOCAL Postgres"
echo "  - Novu is used as an orchestration adapter only"
echo "  - External providers receive: rendered message + recipient address + token"
echo "  - No customer PII (names, health data, profiles) is ever sent to providers"
