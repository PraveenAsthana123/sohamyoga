#!/usr/bin/env bash
# SohamYoga — clone student & customer management stack
# Part 3: Frappe Education, ERPNext, Frappe CRM, Formbricks, Chatwoot, Lago, Novu, PostHog, Keycloak
# Run: bash clone-student-mgmt.sh

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

echo "=== SohamYoga: Student & Customer Management Stack ==="
echo ""

echo "--- 1. Frappe Docker (deployment tooling) ---"
clone_if_missing frappe-docker         https://github.com/frappe/frappe_docker.git
echo ""

echo "--- 2. Frappe Education (student portal, attendance, courses) ---"
clone_if_missing frappe/education      https://github.com/frappe/education.git
echo ""

echo "--- 3. ERPNext (billing, payments, customer, loyalty) ---"
clone_if_missing frappe/erpnext        https://github.com/frappe/erpnext.git
echo ""

echo "--- 4. Frappe CRM (lead management, customer 360) ---"
clone_if_missing frappe/crm            https://github.com/frappe/crm.git
echo ""

echo "--- 5. Formbricks (health questionnaire, onboarding surveys) ---"
clone_if_missing formbricks            https://github.com/formbricks/formbricks.git
echo ""

echo "--- 6. Chatwoot (live chat, customer support inbox) ---"
clone_if_missing chatwoot              https://github.com/chatwoot/chatwoot.git
echo ""

echo "--- 7. Lago (membership billing, subscription engine) ---"
clone_if_missing lago                  https://github.com/getlago/lago.git
echo ""

echo "--- 8. Novu (notifications: email, push, in-app, SMS) ---"
clone_if_missing novu                  https://github.com/novuhq/novu.git
echo ""

echo "--- 9. PostHog (customer analytics, session replay, funnels) ---"
if [ ! -d "posthog/.git" ]; then
  echo "  [clone] PostHog/posthog → posthog"
  git clone --depth 1 https://github.com/PostHog/posthog.git posthog
else
  echo "  [skip] posthog already exists"
fi
echo ""

echo "--- 10. Habitica source (STUDY ONLY — do not integrate fully) ---"
HABITICA_DIR="habitica-reference"
if [ ! -d "$HABITICA_DIR/.git" ]; then
  echo "  [clone] Habitica/habitica → $HABITICA_DIR (study gamification concepts only)"
  git clone --depth 1 https://github.com/HabitRPG/habitica.git "$HABITICA_DIR"
else
  echo "  [skip] $HABITICA_DIR already exists"
fi
echo ""

echo "=== Done. Repos in: $BASE ==="
echo ""
echo "Deploy order (from Part 3 analysis):"
echo "  1. docker compose -f ../integrations/frappe/docker-compose.yml up -d"
echo "     → creates Frappe site, installs ERPNext + Education + CRM"
echo "  2. docker compose -f ../integrations/formbricks/docker-compose.yml up -d"
echo "  3. docker compose -f ../integrations/chatwoot/docker-compose.yml up -d"
echo "  4. Connect via APIs and webhooks — see /integrations/ adapters"
echo ""
echo "IMPORTANT: Habitica ($HABITICA_DIR) is for reference only."
echo "  Study: points, streaks, badges, challenges, rewards"
echo "  Built custom in: src/domain/gamification/Achievement.ts"
