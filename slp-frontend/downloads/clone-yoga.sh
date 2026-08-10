#!/usr/bin/env bash
# Wave 19: Yoga-Specific Library — open-source tool bootstrap
# Clones and configures self-hosted services for the yoga library module
# Services: Qdrant, Meilisearch, MediaCMS, OpenMediaVault, Directus, LimeSurvey, Keycloak
# Usage: bash downloads/clone-yoga.sh [--dir <install_dir>]

set -euo pipefail

INSTALL_DIR="${2:-/opt/slp-yoga}"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

info()  { echo "[INFO]  $*"; }
warn()  { echo "[WARN]  $*"; }
die()   { echo "[ERROR] $*" >&2; exit 1; }

require() {
  command -v "$1" >/dev/null 2>&1 || die "Required: $1 (install with: $2)"
}

require git    "apt install git / brew install git"
require docker "https://docs.docker.com/get-docker/"
require curl   "apt install curl"

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# ── 1. Qdrant — Vector DB for Pose / Asana Semantic Search ───────────────────
info "Cloning Qdrant (vector database for semantic asana search)"
if [ ! -d "qdrant" ]; then
  mkdir qdrant && cd qdrant
  cat > docker-compose.yml <<'QDRANT'
version: "3.9"
services:
  qdrant:
    image: qdrant/qdrant:latest
    restart: unless-stopped
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_storage:/qdrant/storage
    environment:
      QDRANT__SERVICE__API_KEY: "${QDRANT_API_KEY:-changeme}"
volumes:
  qdrant_storage:
QDRANT
  echo "QDRANT_API_KEY=changeme-$(date +%s)" > .env
  cd ..
else
  warn "qdrant/ already exists — skipping"
fi

# ── 2. Meilisearch — Full-text Asana / Pranayama Search ──────────────────────
info "Cloning Meilisearch (full-text search for yoga library)"
if [ ! -d "meilisearch" ]; then
  mkdir meilisearch && cd meilisearch
  cat > docker-compose.yml <<'MEILI'
version: "3.9"
services:
  meilisearch:
    image: getmeili/meilisearch:latest
    restart: unless-stopped
    ports:
      - "7700:7700"
    volumes:
      - meili_data:/meili_data
    environment:
      MEILI_MASTER_KEY: "${MEILI_MASTER_KEY:-changeme}"
      MEILI_ENV: "production"
volumes:
  meili_data:
MEILI
  echo "MEILI_MASTER_KEY=changeme-$(date +%s)" > .env
  cd ..
else
  warn "meilisearch/ already exists — skipping"
fi

# ── 3. MediaCMS — Video Hosting for Asana Demos / Meditation Sessions ────────
info "Cloning MediaCMS (self-hosted video for asana demos)"
if [ ! -d "mediacms" ]; then
  git clone --depth=1 https://github.com/mediacms-io/mediacms.git mediacms
  cd mediacms
  cp .env.docker .env 2>/dev/null || true
  info "Edit mediacms/.env — set DJANGO_SECRET_KEY, POSTGRES_PASSWORD before starting"
  cd ..
else
  warn "mediacms/ already exists — skipping"
fi

# ── 4. Directus — Headless CMS for Yoga Content Management ───────────────────
info "Setting up Directus (headless CMS for yoga content)"
if [ ! -d "directus" ]; then
  mkdir directus && cd directus
  cat > docker-compose.yml <<'DIRECTUS'
version: "3.9"
services:
  directus:
    image: directus/directus:latest
    restart: unless-stopped
    ports:
      - "8055:8055"
    volumes:
      - directus_uploads:/directus/uploads
      - directus_database:/directus/database
    environment:
      SECRET: "${DIRECTUS_SECRET:-changeme}"
      ADMIN_EMAIL: "${DIRECTUS_ADMIN_EMAIL:-admin@example.com}"
      ADMIN_PASSWORD: "${DIRECTUS_ADMIN_PASSWORD:-changeme}"
      DB_CLIENT: "sqlite3"
      DB_FILENAME: "/directus/database/data.db"
volumes:
  directus_uploads:
  directus_database:
DIRECTUS
  cat > .env <<'DENV'
DIRECTUS_SECRET=changeme
DIRECTUS_ADMIN_EMAIL=admin@example.com
DIRECTUS_ADMIN_PASSWORD=changeme
DENV
  cd ..
else
  warn "directus/ already exists — skipping"
fi

# ── 5. Strapi — Alternative CMS for Pranayama / Sequence Content ─────────────
info "Cloning Strapi (alternative headless CMS for yoga sequences)"
if [ ! -d "strapi" ]; then
  mkdir strapi && cd strapi
  cat > docker-compose.yml <<'STRAPI'
version: "3.9"
services:
  strapi:
    image: strapi/strapi:latest
    restart: unless-stopped
    ports:
      - "1337:1337"
    volumes:
      - strapi_data:/srv/app
    environment:
      DATABASE_CLIENT: "sqlite"
      DATABASE_FILENAME: ".tmp/data.db"
      JWT_SECRET: "${STRAPI_JWT_SECRET:-changeme}"
      ADMIN_JWT_SECRET: "${STRAPI_ADMIN_JWT_SECRET:-changeme}"
      APP_KEYS: "${STRAPI_APP_KEYS:-key1,key2,key3,key4}"
volumes:
  strapi_data:
STRAPI
  echo "STRAPI_JWT_SECRET=changeme" > .env
  cd ..
else
  warn "strapi/ already exists — skipping"
fi

# ── 6. LimeSurvey — Dosha / Student Intake Assessments ───────────────────────
info "Cloning LimeSurvey (student intake + dosha assessment surveys)"
if [ ! -d "limesurvey" ]; then
  mkdir limesurvey && cd limesurvey
  cat > docker-compose.yml <<'LIME'
version: "3.9"
services:
  limesurvey:
    image: martialblog/limesurvey:latest
    restart: unless-stopped
    ports:
      - "8085:80"
    volumes:
      - limesurvey_data:/var/www/html/upload
    environment:
      DB_TYPE: "mysql"
      DB_HOST: "limesurvey_db"
      DB_PORT: "3306"
      DB_NAME: "limesurvey"
      DB_USER: "limesurvey"
      DB_PASSWORD: "${LIMESURVEY_DB_PASSWORD:-changeme}"
      ADMIN_USER: "admin"
      ADMIN_PASSWORD: "${LIMESURVEY_ADMIN_PASSWORD:-changeme}"
      ADMIN_EMAIL: "${LIMESURVEY_ADMIN_EMAIL:-admin@example.com}"
  limesurvey_db:
    image: mysql:8.0
    restart: unless-stopped
    environment:
      MYSQL_DATABASE: "limesurvey"
      MYSQL_USER: "limesurvey"
      MYSQL_PASSWORD: "${LIMESURVEY_DB_PASSWORD:-changeme}"
      MYSQL_ROOT_PASSWORD: "${LIMESURVEY_DB_ROOT_PASSWORD:-changeme_root}"
    volumes:
      - limesurvey_db_data:/var/lib/mysql
volumes:
  limesurvey_data:
  limesurvey_db_data:
LIME
  echo "LIMESURVEY_DB_PASSWORD=changeme" > .env
  cd ..
else
  warn "limesurvey/ already exists — skipping"
fi

# ── 7. Immich — Photo Library for Asana Reference Images ─────────────────────
info "Cloning Immich (self-hosted photo library for asana reference images)"
if [ ! -d "immich" ]; then
  mkdir immich && cd immich
  curl -sSfL https://github.com/immich-app/immich/releases/latest/download/docker-compose.yml \
    -o docker-compose.yml
  curl -sSfL https://github.com/immich-app/immich/releases/latest/download/example.env \
    -o .env
  info "Edit immich/.env — set DB_PASSWORD, JWT_SECRET before starting"
  cd ..
else
  warn "immich/ already exists — skipping"
fi

# ── 8. OpenProject — Task Tracking for Yoga Content Roadmap ──────────────────
info "Cloning OpenProject (project management for yoga content roadmap)"
if [ ! -d "openproject" ]; then
  mkdir openproject && cd openproject
  cat > docker-compose.yml <<'OP'
version: "3.9"
services:
  openproject:
    image: openproject/openproject:15
    restart: unless-stopped
    ports:
      - "8082:80"
    volumes:
      - op_data:/var/openproject/assets
    environment:
      SECRET_KEY_BASE: "${OP_SECRET_KEY:-changeme}"
      OPENPROJECT_DEFAULT_LANGUAGE: "en"
volumes:
  op_data:
OP
  echo "OP_SECRET_KEY=changeme" > .env
  cd ..
else
  warn "openproject/ already exists — skipping"
fi

# ── 9. Mattermost — Team Chat for Yoga Instructors ───────────────────────────
info "Cloning Mattermost (team chat for yoga instructors)"
if [ ! -d "mattermost" ]; then
  git clone --depth=1 https://github.com/mattermost/docker.git mattermost
  cd mattermost
  cp env.example .env 2>/dev/null || true
  info "Edit mattermost/.env — set MM_SQLSETTINGS_DATASOURCE, DOMAIN before starting"
  cd ..
else
  warn "mattermost/ already exists — skipping"
fi

# ── 10. Wiki.js — Knowledge Base for Sanskrit / Anatomy Glossary ─────────────
info "Cloning Wiki.js (knowledge base for Sanskrit terms + anatomy glossary)"
if [ ! -d "wikijs" ]; then
  mkdir wikijs && cd wikijs
  cat > docker-compose.yml <<'WIKI'
version: "3.9"
services:
  wiki:
    image: ghcr.io/requarks/wiki:2
    restart: unless-stopped
    ports:
      - "3010:3000"
    volumes:
      - wiki_data:/wiki/data
    environment:
      DB_TYPE: "sqlite"
  wikijs_db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: wiki
      POSTGRES_USER: wikijs
      POSTGRES_PASSWORD: "${WIKI_DB_PASSWORD:-changeme}"
    volumes:
      - wiki_db_data:/var/lib/postgresql/data
volumes:
  wiki_data:
  wiki_db_data:
WIKI
  echo "WIKI_DB_PASSWORD=changeme" > .env
  cd ..
else
  warn "wikijs/ already exists — skipping"
fi

# ── 11. Metabase — Analytics Dashboard for Yoga Usage Stats ──────────────────
info "Setting up Metabase (analytics for yoga library usage)"
if [ ! -d "metabase" ]; then
  mkdir metabase && cd metabase
  cat > docker-compose.yml <<'MB'
version: "3.9"
services:
  metabase:
    image: metabase/metabase:latest
    restart: unless-stopped
    ports:
      - "3030:3000"
    volumes:
      - metabase_data:/metabase-data
    environment:
      MB_DB_TYPE: "h2"
      MB_DB_FILE: "/metabase-data/metabase.db"
volumes:
  metabase_data:
MB
  cd ..
else
  warn "metabase/ already exists — skipping"
fi

# ── 12. n8n — Workflow Automation for Content Publishing ─────────────────────
info "Setting up n8n (workflow automation for yoga content publishing)"
if [ ! -d "n8n" ]; then
  mkdir n8n && cd n8n
  cat > docker-compose.yml <<'N8N'
version: "3.9"
services:
  n8n:
    image: n8nio/n8n:latest
    restart: unless-stopped
    ports:
      - "5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n
    environment:
      N8N_BASIC_AUTH_ACTIVE: "true"
      N8N_BASIC_AUTH_USER: "${N8N_USER:-admin}"
      N8N_BASIC_AUTH_PASSWORD: "${N8N_PASSWORD:-changeme}"
      N8N_ENCRYPTION_KEY: "${N8N_ENCRYPTION_KEY:-changeme}"
volumes:
  n8n_data:
N8N
  echo "N8N_PASSWORD=changeme" > .env
  cd ..
else
  warn "n8n/ already exists — skipping"
fi

# ── 13. Keycloak — SSO for Yoga Content Admin Portal ─────────────────────────
info "Setting up Keycloak (SSO for yoga content admin portal)"
if [ ! -d "keycloak" ]; then
  mkdir keycloak && cd keycloak
  cat > docker-compose.yml <<'KC'
version: "3.9"
services:
  keycloak:
    image: quay.io/keycloak/keycloak:latest
    restart: unless-stopped
    command: start-dev
    ports:
      - "8180:8080"
    environment:
      KEYCLOAK_ADMIN: "${KC_ADMIN:-admin}"
      KEYCLOAK_ADMIN_PASSWORD: "${KC_ADMIN_PASSWORD:-changeme}"
      KC_DB: "dev-file"
KC
  echo "KC_ADMIN_PASSWORD=changeme" > .env
  cd ..
else
  warn "keycloak/ already exists — skipping"
fi

# ── 14. Gotenberg — PDF Generation for Yoga Sequence Handouts ────────────────
info "Setting up Gotenberg (PDF generation for printable yoga sequences)"
if [ ! -d "gotenberg" ]; then
  mkdir gotenberg && cd gotenberg
  cat > docker-compose.yml <<'GOTEN'
version: "3.9"
services:
  gotenberg:
    image: gotenberg/gotenberg:8
    restart: unless-stopped
    ports:
      - "3080:3000"
    command:
      - "gotenberg"
      - "--api-timeout=30s"
      - "--chromium-disable-javascript=true"
GOTEN
  cd ..
else
  warn "gotenberg/ already exists — skipping"
fi

# ── 15. Typesense — Typo-tolerant Search for Yoga Glossary ───────────────────
info "Setting up Typesense (typo-tolerant search for yoga glossary)"
if [ ! -d "typesense" ]; then
  mkdir typesense && cd typesense
  cat > docker-compose.yml <<'TS'
version: "3.9"
services:
  typesense:
    image: typesense/typesense:0.26.0
    restart: unless-stopped
    ports:
      - "8108:8108"
    volumes:
      - typesense_data:/data
    command: '--data-dir /data --api-key="${TYPESENSE_API_KEY:-changeme}" --enable-cors'
volumes:
  typesense_data:
TS
  echo "TYPESENSE_API_KEY=changeme" > .env
  cd ..
else
  warn "typesense/ already exists — skipping"
fi

# ── Port summary ──────────────────────────────────────────────────────────────
cat <<PORTS

============================================================
 Wave 19: Yoga Library — Service Port Map
============================================================
 Service             Port    Purpose
 ─────────────────────────────────────────────────────────
 Qdrant              6333    Vector DB REST API
 Qdrant gRPC         6334    Vector DB gRPC
 Meilisearch         7700    Full-text search
 MediaCMS            8000    Video hosting
 Directus            8055    Headless CMS
 Strapi              1337    Alt. headless CMS
 LimeSurvey          8085    Student assessments
 Immich              2283    Photo library
 OpenProject         8082    Content roadmap
 Mattermost          8065    Instructor chat
 Wiki.js             3010    Sanskrit/anatomy glossary
 Metabase            3030    Usage analytics
 n8n                 5678    Workflow automation
 Keycloak            8180    SSO / admin portal
 Gotenberg           3080    PDF generation
 Typesense           8108    Typo-tolerant search
============================================================

PORTS

# ── Security reminder ─────────────────────────────────────────────────────────
cat <<SECURITY
╔══════════════════════════════════════════════════════════╗
║  SECURITY CHECKLIST — before starting any service        ║
╠══════════════════════════════════════════════════════════╣
║  □ Change ALL default passwords in every .env file       ║
║  □ Never commit .env files (already in .gitignore)       ║
║  □ Enable TLS (nginx/Caddy reverse proxy) in production  ║
║  □ Restrict ports to localhost in production             ║
║  □ Rotate API keys after initial setup                   ║
║  □ Yoga content assets = proprietary — restrict export   ║
║  □ Student dosha/assessment data = PII under PIPEDA s.7  ║
║  □ Asana images/videos — confirm licensing per asset     ║
║  □ Meditation audio — confirm instructor IP rights       ║
║  □ DPDP Act 2023 (India): data localisation for B2C      ║
╚══════════════════════════════════════════════════════════╝

To start a single service (e.g. Qdrant):
  cd $INSTALL_DIR/qdrant && docker compose up -d

To start all services:
  for svc in qdrant meilisearch directus strapi limesurvey \\
             wikijs metabase n8n gotenberg typesense; do
    (cd "$INSTALL_DIR/\$svc" && docker compose up -d) || true
  done

SECURITY

info "Wave 19 yoga tool bootstrap complete — $INSTALL_DIR"
