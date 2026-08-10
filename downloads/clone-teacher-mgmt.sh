#!/usr/bin/env bash
# SohamYoga — clone Teacher Management Module tools (Part 2)
# LibreBooking, LimeSurvey, Wiki.js, Flowable, Nextcloud, Jitsi, Novu
# Run: bash clone-teacher-mgmt.sh

set -euo pipefail
BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BASE"

clone_if_missing() {
  local dir="$1"; local url="$2"
  if [ -d "$dir/.git" ]; then
    echo "  [skip] $dir already exists"
  else
    echo "  [clone] $url → $dir"
    git clone --depth 1 "$url" "$dir"
  fi
}

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   SohamYoga — Teacher Management Module (Part 2) Clone     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

echo "─── 1. LibreBooking (QR attendance, room/resource scheduling) ─"
clone_if_missing librebooking  https://github.com/librebooking/librebooking.git
echo ""

echo "─── 2. LimeSurvey (teacher feedback, NPS, course surveys) ────"
clone_if_missing limesurvey    https://github.com/LimeSurvey/LimeSurvey.git
echo ""

echo "─── 3. Wiki.js (SOPs, manuals, class guidelines) ─────────────"
clone_if_missing wikijs        https://github.com/requarks/wiki.git
echo ""

echo "─── 4. Flowable (substitute workflow, cert renewal BPMN) ─────"
clone_if_missing flowable      https://github.com/flowable/flowable-engine.git
echo ""

echo "─── 5. Nextcloud (file sharing: lesson plans, playlists) ─────"
clone_if_missing nextcloud     https://github.com/nextcloud/server.git
echo ""

echo "─── 6. Jitsi Meet (self-hosted video for online classes) ──────"
clone_if_missing jitsi-meet    https://github.com/jitsi/jitsi-meet.git
echo ""

echo "─── 7. Novu (notifications: cert expiry, sub alerts) ──────────"
if [ -d "novu/.git" ]; then
  echo "  [skip] novu already exists"
else
  echo "  [clone] novuhq/novu → novu"
  git clone --depth 1 https://github.com/novuhq/novu.git novu
fi
echo ""

echo "─── 8. Mattermost (team announcements, collaboration) ─────────"
clone_if_missing mattermost    https://github.com/mattermost/mattermost.git
echo ""

echo "─── 9. Open WebUI (Ollama AI FAQ / teacher assistant UI) ──────"
clone_if_missing open-webui    https://github.com/open-webui/open-webui.git
echo ""

echo "─── 10. PeerTube (teacher intro videos — self-hosted) ─────────"
clone_if_missing peertube      https://github.com/Chocobozzz/PeerTube.git
echo ""

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                  Clone complete!                            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Service ports for Teacher Management Module:"
echo ""
printf "  %-28s %s\n" "LibreBooking (QR attendance)"  "8030"
printf "  %-28s %s\n" "LimeSurvey (feedback/NPS)"     "8040"
printf "  %-28s %s\n" "Wiki.js (knowledge base)"       "8050"
printf "  %-28s %s\n" "Flowable (workflows)"           "8060"
printf "  %-28s %s\n" "Nextcloud (file sharing)"       "8070"
printf "  %-28s %s\n" "Jitsi Meet (video classes)"     "8443"
printf "  %-28s %s\n" "Novu (notifications)"           "4001"
printf "  %-28s %s\n" "Open WebUI (AI assistant)"      "8080"
echo ""
echo "Start order:"
echo "  docker compose -f ../integrations/librebooking/docker-compose.yml up -d"
echo "  docker compose -f ../integrations/limesurvey/docker-compose.yml up -d"
echo "  docker compose -f ../integrations/wikijs/docker-compose.yml up -d"
echo "  docker compose -f ../integrations/flowable/docker-compose.yml up -d"
echo "  docker compose -f ../integrations/nextcloud/docker-compose.yml up -d"
echo "  docker compose -f ../integrations/jitsi/docker-compose.yml up -d"
echo ""
echo "Note: Jitsi requires JITSI_HOST_IP=<your-server-ip> in .env for WebRTC."
echo "Note: Authentik SSO must be running first for OIDC login on Wiki.js/Nextcloud."
