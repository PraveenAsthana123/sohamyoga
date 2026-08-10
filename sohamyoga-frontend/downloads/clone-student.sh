#!/usr/bin/env bash
# Clone script for Part 3: Student & Customer Management
# Run from the project root: bash downloads/clone-student.sh
#
# Services: Frappe Education, ERPNext, Frappe CRM, Formbricks, Chatwoot,
#           Lago (billing), PostHog (analytics), Novu (notifications),
#           Habitica (study reference ONLY — do NOT integrate)
#
# Sequence:
#   1. frappe_docker   — Docker Compose base for Frappe / ERPNext
#   2. frappe-bench    — Frappe framework source
#   3. education       — Frappe Education app
#   4. erpnext         — ERPNext app (install alongside Education via bench)
#   5. crm             — Frappe CRM app
#   6. formbricks      — Health questionnaires & yoga goals surveys
#   7. chatwoot        — Customer support & live chat
#   8. lago            — Open-source billing / invoice mirroring
#   9. posthog         — Analytics (already cloned in Wave 13, skip if present)
#  10. novu             — Notification infrastructure (already cloned, skip if present)
#  11. habitica         — STUDY REFERENCE ONLY — do NOT integrate the Habitica app
#
# Frappe / ERPNext deploy sequence (after cloning):
#   1. cd frappe_docker && cp -n .env.example .env && edit .env
#   2. docker compose -f compose.yaml \
#        -f overrides/compose.erpnext.yaml \
#        -f overrides/compose.education.yaml \
#        up -d
#   3. docker compose exec backend bench --site <site> install-app erpnext
#   4. docker compose exec backend bench --site <site> install-app education
#   5. docker compose exec backend bench --site <site> install-app crm

set -euo pipefail

DEST="${1:-downloads/repos}"
mkdir -p "$DEST"
cd "$DEST"

clone() {
  local url="$1"
  local dir="$2"
  if [ -d "$dir/.git" ]; then
    echo "[skip] $dir already exists — run 'git -C $dir pull' to update"
  else
    echo "[clone] $dir"
    git clone --depth 1 "$url" "$dir"
  fi
}

echo "=== Part 3: Student & Customer Management — repo clone ==="

# ── 1. Frappe Docker (deployment base) ────────────────────────────────────────
clone "https://github.com/frappe/frappe_docker.git" "frappe_docker"

# ── 2. Frappe bench (framework source — for reference) ────────────────────────
clone "https://github.com/frappe/frappe.git" "frappe"

# ── 3. Frappe Education ───────────────────────────────────────────────────────
clone "https://github.com/frappe/education.git" "frappe-education"

# ── 4. ERPNext ────────────────────────────────────────────────────────────────
clone "https://github.com/frappe/erpnext.git" "erpnext"

# ── 5. Frappe CRM ─────────────────────────────────────────────────────────────
clone "https://github.com/frappe/crm.git" "frappe-crm"

# ── 6. Formbricks (health questionnaires + yoga goals surveys) ────────────────
clone "https://github.com/formbricks/formbricks.git" "formbricks"

# ── 7. Chatwoot (customer support, live chat, Chatwoot contact sync) ──────────
clone "https://github.com/chatwoot/chatwoot.git" "chatwoot"

# ── 8. Lago (open-source billing, invoice mirroring) ─────────────────────────
clone "https://github.com/getlago/lago.git" "lago"

# ── 9. PostHog (analytics — skip if already present from Wave 13) ─────────────
if [ ! -d "posthog/.git" ]; then
  echo "[clone] posthog"
  git clone --depth 1 "https://github.com/PostHog/posthog.git" "posthog"
else
  echo "[skip] posthog already present"
fi

# ── 10. Novu (notifications — skip if already present from Wave 14) ───────────
if [ ! -d "novu/.git" ]; then
  echo "[clone] novu"
  git clone --depth 1 "https://github.com/novuhq/novu.git" "novu"
else
  echo "[skip] novu already present"
fi

# ── 11. Habitica — STUDY REFERENCE ONLY ─────────────────────────────────────
# WARNING: Do NOT integrate the Habitica application into the portal.
# Habitica is cloned ONLY to study its gamification concepts:
#   - points / XP ledger
#   - streak mechanics
#   - badge / achievement structure
#   - challenge & party system
#   - reward shop
# All gamification features are REBUILT from scratch in src/domain/gamification/*.
clone "https://github.com/HabitRPG/habitica.git" "habitica-study-ref"
echo ""
echo "WARNING: habitica-study-ref/ is a STUDY REFERENCE."
echo "Do NOT import Habitica code into the portal. Gamification is rebuilt"
echo "in src/domain/gamification/ using custom yoga-specific models."
echo ""

echo ""
echo "=== Clone complete ==="
echo ""
echo "Repos in $DEST:"
ls -d "$DEST"/*/
echo ""
echo "Frappe deploy checklist:"
echo "  1. cd $DEST/frappe_docker"
echo "  2. cp .env.example .env && edit .env (set SITE_NAME, passwords, SMTP)"
echo "  3. docker compose -f compose.yaml \\"
echo "       -f overrides/compose.erpnext.yaml \\"
echo "       up -d"
echo "  4. docker compose exec backend bench new-site <site> --install-app erpnext"
echo "  5. docker compose exec backend bench --site <site> install-app education"
echo "  6. docker compose exec backend bench --site <site> install-app crm"
echo ""
echo "Formbricks deploy:"
echo "  cd $DEST/formbricks && cp .env.example .env && docker compose up -d"
echo ""
echo "Chatwoot deploy:"
echo "  cd $DEST/chatwoot && cp .env.example .env && docker compose up -d"
