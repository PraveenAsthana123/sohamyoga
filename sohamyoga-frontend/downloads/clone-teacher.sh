#!/usr/bin/env bash
# Wave 18: Teacher Management — open-source tool bootstrap
# Clones and configures all self-hosted services for the teacher management module
# Usage: bash downloads/clone-teacher.sh [--dir <install_dir>]

set -euo pipefail

INSTALL_DIR="${2:-/opt/sohamyoga-teacher}"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

info()  { echo "[INFO]  $*"; }
warn()  { echo "[WARN]  $*"; }
die()   { echo "[ERROR] $*" >&2; exit 1; }

require() {
  command -v "$1" >/dev/null 2>&1 || die "Required: $1 (install with: $2)"
}

require git   "apt install git / brew install git"
require docker "https://docs.docker.com/get-docker/"
require curl   "apt install curl"

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# ── 1. Authentik — Identity Provider ─────────────────────────────────────────
info "Cloning Authentik (Identity Provider)"
if [ ! -d "authentik" ]; then
  mkdir authentik && cd authentik
  curl -sSfL https://raw.githubusercontent.com/goauthentik/authentik/main/docker-compose.yml \
    -o docker-compose.yml
  info "  → Edit authentik/docker-compose.yml: set PG_PASS, AUTHENTIK_SECRET_KEY"
  cd ..
else
  warn "authentik/ already exists, skipping"
fi

# ── 2. Cal.com — Scheduling ───────────────────────────────────────────────────
info "Cloning Cal.com (Scheduling)"
if [ ! -d "calcom" ]; then
  git clone --depth 1 --branch main \
    https://github.com/calcom/cal.com.git calcom
  info "  → Copy calcom/.env.example → calcom/.env; set DATABASE_URL, NEXTAUTH_SECRET"
else
  warn "calcom/ already exists, skipping"
fi

# ── 3. LibreBooking — Studio Resource Scheduling ─────────────────────────────
info "Cloning LibreBooking (Resource/Room Scheduling)"
if [ ! -d "librebooking" ]; then
  git clone --depth 1 https://github.com/LibreBooking/app.git librebooking
  info "  → Configure librebooking/config/config.php: database host/user/pass"
else
  warn "librebooking/ already exists, skipping"
fi

# ── 4. Rocket.Chat — Staff Communication ─────────────────────────────────────
info "Cloning Rocket.Chat (Staff Chat)"
if [ ! -d "rocketchat" ]; then
  mkdir rocketchat && cd rocketchat
  curl -sSfL https://raw.githubusercontent.com/RocketChat/Rocket.Chat/develop/docker-compose.yml \
    -o docker-compose.yml
  info "  → Edit rocketchat/docker-compose.yml: MONGO_URL, ROOT_URL"
  cd ..
else
  warn "rocketchat/ already exists, skipping"
fi

# ── 5. Mattermost — Alternative Staff Chat ───────────────────────────────────
info "Cloning Mattermost (Alternative Staff Chat)"
if [ ! -d "mattermost" ]; then
  git clone --depth 1 https://github.com/mattermost/docker.git mattermost
  info "  → Copy mattermost/env.example → mattermost/.env; set MM_SQLSETTINGS_DATASOURCE"
else
  warn "mattermost/ already exists, skipping"
fi

# ── 6. Wiki.js — Knowledge Base ───────────────────────────────────────────────
info "Cloning Wiki.js (Teacher Knowledge Base)"
if [ ! -d "wikijs" ]; then
  mkdir wikijs && cd wikijs
  cat > docker-compose.yml <<'WIKIJS'
version: "3"
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: wiki
      POSTGRES_USER: wikijs
      POSTGRES_PASSWORD: wikijsrocks
    volumes: [wikijs-data:/var/lib/postgresql/data]
  wiki:
    image: ghcr.io/requarks/wiki:2
    depends_on: [db]
    ports: ["3001:3000"]
    environment:
      DB_TYPE: postgres
      DB_HOST: db
      DB_PORT: 5432
      DB_USER: wikijs
      DB_PASS: wikijsrocks
      DB_NAME: wiki
volumes:
  wikijs-data:
WIKIJS
  info "  → Run: docker compose -f wikijs/docker-compose.yml up -d"
  cd ..
else
  warn "wikijs/ already exists, skipping"
fi

# ── 7. Paperless-ngx — Document Management ───────────────────────────────────
info "Cloning Paperless-ngx (Teacher Documents)"
if [ ! -d "paperless-ngx" ]; then
  git clone --depth 1 https://github.com/paperless-ngx/paperless-ngx.git paperless-ngx
  info "  → Copy paperless-ngx/docker/compose/docker-compose.postgres.yml"
  info "  → Set PAPERLESS_SECRET_KEY, PAPERLESS_ADMIN_USER"
else
  warn "paperless-ngx/ already exists, skipping"
fi

# ── 8. Moodle — LMS ───────────────────────────────────────────────────────────
info "Cloning Moodle (LMS for CPD courses)"
if [ ! -d "moodle" ]; then
  git clone --depth 1 --branch MOODLE_404_STABLE \
    https://github.com/moodle/moodle.git moodle
  info "  → Point Apache/Nginx DocumentRoot to moodle/"
  info "  → Run install.php; set MOODLE_DATA_DIR, DB credentials"
else
  warn "moodle/ already exists, skipping"
fi

# ── 9. LimeSurvey — Feedback & NPS ───────────────────────────────────────────
info "Cloning LimeSurvey (Teacher Feedback + NPS)"
if [ ! -d "limesurvey" ]; then
  git clone --depth 1 \
    https://github.com/LimeSurvey/LimeSurvey.git limesurvey
  info "  → Run: php application/commands/console.php install admin password admin@example.com"
else
  warn "limesurvey/ already exists, skipping"
fi

# ── 10. ERPNext / Frappe HR ───────────────────────────────────────────────────
info "Cloning ERPNext (Payroll + HR)"
if [ ! -d "frappe-docker" ]; then
  git clone --depth 1 https://github.com/frappe/frappe_docker.git frappe-docker
  info "  → cd frappe-docker && cp example.env .env"
  info "  → docker compose -f compose.yaml up -d"
  info "  → Install ERPNext + HRMS apps via bench"
else
  warn "frappe-docker/ already exists, skipping"
fi

# ── 11. Akaunting — Accounting ────────────────────────────────────────────────
info "Cloning Akaunting (Accounting / Commission Tracking)"
if [ ! -d "akaunting" ]; then
  git clone --depth 1 https://github.com/akaunting/akaunting.git akaunting
  info "  → Configure akaunting/.env: DB_DATABASE, APP_URL"
else
  warn "akaunting/ already exists, skipping"
fi

# ── 12. Flowable — Workflow Engine ───────────────────────────────────────────
info "Pulling Flowable Docker image (Workflow / BPMN)"
if ! docker images | grep -q "flowable/flowable-rest"; then
  docker pull flowable/flowable-rest:latest
  info "  → docker run -d -p 8080:8080 flowable/flowable-rest"
  info "  → Default credentials: admin / test"
else
  warn "flowable/flowable-rest image already present"
fi

# ── 13. Jitsi Meet — Video Classes ───────────────────────────────────────────
info "Cloning Jitsi Meet (Video Consultations)"
if [ ! -d "jitsi-docker" ]; then
  git clone --depth 1 https://github.com/jitsi/docker-jitsi-meet.git jitsi-docker
  info "  → cd jitsi-docker && cp env.example .env && ./gen-passwords.sh"
  info "  → docker compose up -d"
else
  warn "jitsi-docker/ already exists, skipping"
fi

# ── 14. Nextcloud — File Sharing ─────────────────────────────────────────────
info "Cloning Nextcloud (Lesson Plan File Sharing)"
if [ ! -d "nextcloud" ]; then
  mkdir nextcloud && cd nextcloud
  curl -sSfL https://raw.githubusercontent.com/nextcloud/all-in-one/main/compose.yaml \
    -o docker-compose.yml
  info "  → Visit http://localhost:8080 after: docker compose up -d"
  cd ..
else
  warn "nextcloud/ already exists, skipping"
fi

# ── 15. Formbricks — Open-source Surveys ────────────────────────────────────
info "Cloning Formbricks (Alternative Survey Tool)"
if [ ! -d "formbricks" ]; then
  git clone --depth 1 https://github.com/formbricks/formbricks.git formbricks
  info "  → cd formbricks && cp .env.example .env && docker compose up -d"
else
  warn "formbricks/ already exists, skipping"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════════"
echo " Wave 18 Teacher Management — Clone Complete"
echo " Install dir: $INSTALL_DIR"
echo ""
echo " Services cloned / configured:"
echo "   1. Authentik            — Identity (OIDC/SAML)          port: 9000"
echo "   2. Cal.com              — Scheduling                     port: 3000"
echo "   3. LibreBooking         — Resource scheduling            port: 8080"
echo "   4. Rocket.Chat          — Staff chat                     port: 3002"
echo "   5. Mattermost           — Alternative staff chat         port: 8065"
echo "   6. Wiki.js              — Knowledge base                 port: 3001"
echo "   7. Paperless-ngx        — Document vault                 port: 8000"
echo "   8. Moodle               — LMS / CPD                      Apache/Nginx"
echo "   9. LimeSurvey           — Feedback surveys               port: 8001"
echo "  10. ERPNext + Frappe HR  — Payroll / HR                   port: 8004"
echo "  11. Akaunting            — Accounting / commission        port: 8082"
echo "  12. Flowable             — BPMN workflow engine           port: 8090"
echo "  13. Jitsi Meet           — Video consultations            port: 8443"
echo "  14. Nextcloud            — File sharing                   port: 8081"
echo "  15. Formbricks           — Surveys (alternative)         port: 3003"
echo ""
echo " SECURITY REMINDERS:"
echo "   - Never commit .env files"
echo "   - Change all default passwords before going live"
echo "   - Enable TLS/HTTPS for all services in production"
echo "   - Review PIPEDA/DPDP data residency before cloud deploy"
echo "══════════════════════════════════════════════════════════════════"
