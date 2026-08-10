#!/usr/bin/env bash
# SohamYoga — clone ALL 10 platform modules (Part 4)
# ERPNext, Frappe HR, Frappe Education, Cal.com, Paperless-ngx,
# Authentik, Rocket.Chat, Moodle, Metabase, PostHog
# Run: bash clone-platform.sh

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
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     SohamYoga — Full Platform Clone (10 modules)        ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

echo "─── 1. ERPNext (billing, payments, loyalty, inventory) ───"
clone_if_missing frappe/erpnext          https://github.com/frappe/erpnext.git
echo ""

echo "─── 2. Frappe HR (payroll, leave, appraisals, CPD) ───────"
clone_if_missing frappe/hrms             https://github.com/frappe/hrms.git
echo ""

echo "─── 3. Frappe Education (student, teacher, courses) ───────"
clone_if_missing frappe/education        https://github.com/frappe/education.git
echo ""

echo "─── 4. Frappe Docker (deployment tooling) ─────────────────"
clone_if_missing frappe/frappe-docker    https://github.com/frappe/frappe_docker.git
echo ""

echo "─── 5. Cal.com (booking & scheduling) ─────────────────────"
clone_if_missing calcom                  https://github.com/calcom/cal.com.git
echo ""

echo "─── 6. Paperless-ngx (document management) ────────────────"
clone_if_missing paperless-ngx           https://github.com/paperless-ngx/paperless-ngx.git
echo ""

echo "─── 7. Authentik (SSO / identity) ─────────────────────────"
clone_if_missing authentik               https://github.com/goauthentik/authentik.git
echo ""

echo "─── 8. Rocket.Chat (internal staff chat) ───────────────────"
clone_if_missing rocketchat              https://github.com/RocketChat/Rocket.Chat.git
echo ""

echo "─── 9. Moodle LMS (teacher training, online courses) ───────"
clone_if_missing moodle                  https://github.com/moodle/moodle.git
echo ""

echo "─── 10. Metabase (analytics dashboards) ────────────────────"
clone_if_missing metabase                https://github.com/metabase/metabase.git
echo ""

echo "─── 11. PostHog (product analytics — already in Part 3) ────"
if [ -d "posthog/.git" ]; then
  echo "  [skip] posthog already exists"
else
  echo "  [clone] PostHog/posthog → posthog"
  git clone --depth 1 https://github.com/PostHog/posthog.git posthog
fi
echo ""

echo "╔══════════════════════════════════════════════════════════╗"
echo "║                 Clone complete!                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Start order (start each independently, then connect via Authentik SSO):"
echo ""
echo "  Phase 1 — Foundation (identity first)"
echo "    docker compose -f ../integrations/authentik/docker-compose.yml up -d"
echo ""
echo "  Phase 2 — Core business"
echo "    docker compose -f ../integrations/frappe/docker-compose.yml up -d"
echo "    # then: bench new-site + install-app erpnext education crm hrms"
echo ""
echo "  Phase 3 — Scheduling & documents"
echo "    docker compose -f ../integrations/calcom/docker-compose.yml up -d"
echo "    docker compose -f ../integrations/paperless/docker-compose.yml up -d"
echo ""
echo "  Phase 4 — Communication & analytics"
echo "    docker compose -f ../integrations/rocketchat/docker-compose.yml up -d"
echo "    docker compose -f ../integrations/moodle/docker-compose.yml up -d"
echo "    docker compose -f ../integrations/metabase/docker-compose.yml up -d"
echo ""
echo "  Or start everything: docker compose -f ../integrations/docker-compose.master.yml up -d"
echo ""
echo "Service ports:"
printf "  %-20s %s\n" "Portal (Next.js)"   "4000"
printf "  %-20s %s\n" "Frappe/ERPNext"      "8080"
printf "  %-20s %s\n" "Cal.com"             "3100"
printf "  %-20s %s\n" "Authentik SSO"       "9000"
printf "  %-20s %s\n" "Metabase"            "3001"
printf "  %-20s %s\n" "Paperless-ngx"       "8010"
printf "  %-20s %s\n" "Moodle LMS"          "8020"
printf "  %-20s %s\n" "Rocket.Chat"         "3200"
printf "  %-20s %s\n" "Postiz Social"       "5000"
