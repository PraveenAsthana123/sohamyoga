#!/usr/bin/env bash
# Wave 20: Enterprise & Multi-Branch — open-source tool bootstrap
# Clones and configures self-hosted services for multi-branch, franchise, corporate wellness
# Services: Twenty CRM, ERPNext, Baserow, Appsmith, Metabase, Keycloak, MinIO,
#           Docuseal, GrowthBook, FreeScout, Infisical, Penpot, n8n, Mattermost, Authentik
# Usage: bash downloads/clone-enterprise.sh [--dir <install_dir>]

set -euo pipefail

INSTALL_DIR="${2:-/opt/slp-enterprise}"
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

# ── 1. Twenty CRM — Enterprise CRM for Franchise & Corporate Accounts ────────
info "Cloning Twenty CRM (enterprise CRM for franchise + corporate accounts)"
if [ ! -d "twenty" ]; then
  git clone --depth=1 https://github.com/twentyhq/twenty.git twenty
  cd twenty
  cp .env.example .env 2>/dev/null || true
  info "Edit twenty/.env — set SIGN_IN_PREFILLED_EMAIL, PG_DATABASE_URL, ACCESS_TOKEN_SECRET"
  cd ..
else
  warn "twenty/ already exists — skipping"
fi

# ── 2. ERPNext / Frappe HR — Multi-Branch HR, Payroll, Inventory ─────────────
info "Cloning ERPNext / Frappe (multi-branch HR, payroll, inventory)"
if [ ! -d "frappe_docker" ]; then
  git clone --depth=1 https://github.com/frappe/frappe_docker.git frappe_docker
  cd frappe_docker
  cp example.env .env 2>/dev/null || true
  info "Edit frappe_docker/.env — set FRAPPE_SITE_NAME, DB_ROOT_PASSWORD, ADMIN_PASSWORD"
  cd ..
else
  warn "frappe_docker/ already exists — skipping"
fi

# ── 3. Baserow — No-code Database for Franchise Tracking ─────────────────────
info "Setting up Baserow (no-code database for franchise tracking)"
if [ ! -d "baserow" ]; then
  mkdir baserow && cd baserow
  cat > docker-compose.yml <<'BASEROW'
version: "3.9"
services:
  baserow:
    image: baserow/baserow:latest
    restart: unless-stopped
    ports:
      - "8080:80"
      - "8443:443"
    volumes:
      - baserow_data:/baserow/data
    environment:
      BASEROW_PUBLIC_URL: "${BASEROW_PUBLIC_URL:-http://localhost:8080}"
      SECRET_KEY: "${BASEROW_SECRET_KEY:-changeme}"
volumes:
  baserow_data:
BASEROW
  echo "BASEROW_SECRET_KEY=changeme" > .env
  cd ..
else
  warn "baserow/ already exists — skipping"
fi

# ── 4. Appsmith — Partner / Corporate Self-Service Portal Builder ─────────────
info "Setting up Appsmith (partner portal and corporate self-service builder)"
if [ ! -d "appsmith" ]; then
  mkdir appsmith && cd appsmith
  curl -sSfL https://raw.githubusercontent.com/appsmithorg/appsmith/release/deploy/docker/docker-compose.yml \
    -o docker-compose.yml
  cat > .env <<'AENV'
APPSMITH_ENCRYPTION_PASSWORD=changeme
APPSMITH_ENCRYPTION_SALT=changeme
APPSMITH_OAUTH2_GOOGLE_CLIENT_ID=
APPSMITH_OAUTH2_GOOGLE_CLIENT_SECRET=
AENV
  info "Edit appsmith/.env — set APPSMITH_ENCRYPTION_PASSWORD and SALT"
  cd ..
else
  warn "appsmith/ already exists — skipping"
fi

# ── 5. Metabase — Cross-Branch Analytics Dashboards ──────────────────────────
info "Setting up Metabase (cross-branch analytics dashboards)"
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
      MB_DB_TYPE: "postgres"
      MB_DB_DBNAME: "${MB_DB_NAME:-metabase}"
      MB_DB_PORT: "5432"
      MB_DB_USER: "${MB_DB_USER:-metabase}"
      MB_DB_PASS: "${MB_DB_PASS:-changeme}"
      MB_DB_HOST: "metabase_db"
  metabase_db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: "${MB_DB_NAME:-metabase}"
      POSTGRES_USER: "${MB_DB_USER:-metabase}"
      POSTGRES_PASSWORD: "${MB_DB_PASS:-changeme}"
    volumes:
      - metabase_db_data:/var/lib/postgresql/data
volumes:
  metabase_data:
  metabase_db_data:
MB
  echo "MB_DB_PASS=changeme" > .env
  cd ..
else
  warn "metabase/ already exists — skipping"
fi

# ── 6. Keycloak — Enterprise SSO / Multi-Tenant Identity ─────────────────────
info "Setting up Keycloak (enterprise SSO for multi-tenant identity)"
if [ ! -d "keycloak" ]; then
  mkdir keycloak && cd keycloak
  cat > docker-compose.yml <<'KC'
version: "3.9"
services:
  keycloak:
    image: quay.io/keycloak/keycloak:latest
    restart: unless-stopped
    command: start-dev --import-realm
    ports:
      - "8180:8080"
    volumes:
      - keycloak_data:/opt/keycloak/data
    environment:
      KEYCLOAK_ADMIN: "${KC_ADMIN:-admin}"
      KEYCLOAK_ADMIN_PASSWORD: "${KC_ADMIN_PASSWORD:-changeme}"
      KC_DB: "dev-file"
volumes:
  keycloak_data:
KC
  echo "KC_ADMIN_PASSWORD=changeme" > .env
  cd ..
else
  warn "keycloak/ already exists — skipping"
fi

# ── 7. MinIO — Object Storage for Contracts, Agreements, Branch Docs ─────────
info "Setting up MinIO (S3-compatible object storage for enterprise documents)"
if [ ! -d "minio" ]; then
  mkdir minio && cd minio
  cat > docker-compose.yml <<'MINIO'
version: "3.9"
services:
  minio:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    environment:
      MINIO_ROOT_USER: "${MINIO_ROOT_USER:-minioadmin}"
      MINIO_ROOT_PASSWORD: "${MINIO_ROOT_PASSWORD:-changeme}"
volumes:
  minio_data:
MINIO
  cat > .env <<'MENV'
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=changeme
MENV
  cd ..
else
  warn "minio/ already exists — skipping"
fi

# ── 8. Docuseal — Document Signing for Franchise Agreements ──────────────────
info "Setting up Docuseal (document signing for franchise agreements)"
if [ ! -d "docuseal" ]; then
  mkdir docuseal && cd docuseal
  cat > docker-compose.yml <<'DS'
version: "3.9"
services:
  docuseal:
    image: docuseal/docuseal:latest
    restart: unless-stopped
    ports:
      - "3060:3000"
    volumes:
      - docuseal_data:/data
    environment:
      SECRET_KEY_BASE: "${DOCUSEAL_SECRET_KEY:-changeme}"
volumes:
  docuseal_data:
DS
  echo "DOCUSEAL_SECRET_KEY=changeme" > .env
  cd ..
else
  warn "docuseal/ already exists — skipping"
fi

# ── 9. GrowthBook — Feature Flags per Branch / Tenant ────────────────────────
info "Setting up GrowthBook (feature flags per branch/tenant)"
if [ ! -d "growthbook" ]; then
  mkdir growthbook && cd growthbook
  cat > docker-compose.yml <<'GB'
version: "3.9"
services:
  growthbook:
    image: growthbook/growthbook:latest
    restart: unless-stopped
    ports:
      - "3100:3000"
      - "3101:3100"
    volumes:
      - growthbook_uploads:/usr/local/src/app/packages/back-end/uploads
    environment:
      MONGODB_URI: "mongodb://growthbook_db:27017/growthbook"
      APP_ORIGIN: "${GB_APP_ORIGIN:-http://localhost:3100}"
      API_HOST: "${GB_API_HOST:-http://localhost:3101}"
  growthbook_db:
    image: mongo:6
    restart: unless-stopped
    volumes:
      - growthbook_db_data:/data/db
volumes:
  growthbook_uploads:
  growthbook_db_data:
GB
  echo "GB_APP_ORIGIN=http://localhost:3100" > .env
  cd ..
else
  warn "growthbook/ already exists — skipping"
fi

# ── 10. FreeScout — Enterprise Helpdesk for Franchisees ──────────────────────
info "Setting up FreeScout (helpdesk for franchisee + corporate support)"
if [ ! -d "freescout" ]; then
  mkdir freescout && cd freescout
  cat > docker-compose.yml <<'FS'
version: "3.9"
services:
  freescout:
    image: tiredofit/freescout:latest
    restart: unless-stopped
    ports:
      - "8090:80"
    volumes:
      - freescout_data:/data
    environment:
      DB_HOST: "freescout_db"
      DB_NAME: "${FS_DB_NAME:-freescout}"
      DB_USER: "${FS_DB_USER:-freescout}"
      DB_PASS: "${FS_DB_PASS:-changeme}"
      SITE_URL: "${FS_SITE_URL:-http://localhost:8090}"
      APP_KEY: "${FS_APP_KEY:-changeme}"
      ADMIN_EMAIL: "${FS_ADMIN_EMAIL:-admin@example.com}"
      ADMIN_FIRST_NAME: "Admin"
      ADMIN_LAST_NAME: "User"
      ADMIN_PASS: "${FS_ADMIN_PASS:-changeme}"
  freescout_db:
    image: mysql:8.0
    restart: unless-stopped
    environment:
      MYSQL_DATABASE: "${FS_DB_NAME:-freescout}"
      MYSQL_USER: "${FS_DB_USER:-freescout}"
      MYSQL_PASSWORD: "${FS_DB_PASS:-changeme}"
      MYSQL_ROOT_PASSWORD: "${FS_DB_ROOT_PASS:-changeme_root}"
    volumes:
      - freescout_db_data:/var/lib/mysql
volumes:
  freescout_data:
  freescout_db_data:
FS
  echo "FS_DB_PASS=changeme" > .env
  cd ..
else
  warn "freescout/ already exists — skipping"
fi

# ── 11. Infisical — Secrets Management per Branch Environment ────────────────
info "Cloning Infisical (secrets management for multi-branch environments)"
if [ ! -d "infisical" ]; then
  git clone --depth=1 https://github.com/Infisical/infisical.git infisical
  cd infisical
  cp .env.example .env 2>/dev/null || true
  info "Edit infisical/.env — set JWT_AUTH_SECRET, ENCRYPTION_KEY, DB connection"
  cd ..
else
  warn "infisical/ already exists — skipping"
fi

# ── 12. Penpot — White-Label Design Asset Management ─────────────────────────
info "Setting up Penpot (design tool for white-label asset management)"
if [ ! -d "penpot" ]; then
  mkdir penpot && cd penpot
  curl -sSfL https://raw.githubusercontent.com/penpotapp/penpot/main/docker/images/docker-compose.yaml \
    -o docker-compose.yml
  curl -sSfL https://raw.githubusercontent.com/penpotapp/penpot/main/docker/images/config.env \
    -o .env
  info "Edit penpot/.env — set PENPOT_FLAGS, PENPOT_SECRET_KEY, SMTP settings"
  cd ..
else
  warn "penpot/ already exists — skipping"
fi

# ── 13. n8n — Workflow Automation for Branch Onboarding ──────────────────────
info "Setting up n8n (workflow automation for branch onboarding + notifications)"
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
      DB_TYPE: "sqlite"
volumes:
  n8n_data:
N8N
  echo "N8N_PASSWORD=changeme" > .env
  cd ..
else
  warn "n8n/ already exists — skipping"
fi

# ── 14. Mattermost — Secure Channel for Franchisee Communication ─────────────
info "Cloning Mattermost (secure messaging channel for franchise network)"
if [ ! -d "mattermost" ]; then
  git clone --depth=1 https://github.com/mattermost/docker.git mattermost
  cd mattermost
  cp env.example .env 2>/dev/null || true
  info "Edit mattermost/.env — set DOMAIN, MM_SQLSETTINGS_DATASOURCE"
  cd ..
else
  warn "mattermost/ already exists — skipping"
fi

# ── 15. Authentik — Identity Provider for Enterprise SSO ─────────────────────
info "Setting up Authentik (enterprise identity provider)"
if [ ! -d "authentik" ]; then
  mkdir authentik && cd authentik
  curl -sSfL https://raw.githubusercontent.com/goauthentik/authentik/main/docker-compose.yml \
    -o docker-compose.yml
  echo "PG_PASS=changeme" > .env
  echo "AUTHENTIK_SECRET_KEY=changeme" >> .env
  info "Edit authentik/.env — set PG_PASS and AUTHENTIK_SECRET_KEY"
  cd ..
else
  warn "authentik/ already exists — skipping"
fi

# ── Port summary ──────────────────────────────────────────────────────────────
cat <<PORTS

============================================================
 Wave 20: Enterprise & Multi-Branch — Service Port Map
============================================================
 Service          Port      Purpose
 ─────────────────────────────────────────────────────────
 Twenty CRM       3000      Enterprise CRM
 ERPNext (Frappe) 8000      Multi-branch HR + ERP
 Baserow          8080      No-code franchise tracking DB
 Appsmith         80        Partner portal builder
 Metabase         3030      Cross-branch analytics
 Keycloak         8180      Enterprise SSO
 MinIO API        9000      Object storage (contracts)
 MinIO Console    9001      Storage admin UI
 Docuseal         3060      Document signing
 GrowthBook       3100      Feature flags per branch
 FreeScout        8090      Franchisee helpdesk
 Infisical        8000*     Secrets management (* alt port)
 Penpot           3449      White-label design tool
 n8n              5678      Workflow automation
 Mattermost       8065      Franchise network chat
 Authentik        9000*     Identity provider (* alt port)
============================================================
* Check individual service .env for port conflicts

PORTS

# ── Security reminder ─────────────────────────────────────────────────────────
cat <<SECURITY
╔══════════════════════════════════════════════════════════╗
║  SECURITY CHECKLIST — Enterprise deployment              ║
╠══════════════════════════════════════════════════════════╣
║  □ Change ALL default passwords in every .env file       ║
║  □ Never commit .env files (already in .gitignore)       ║
║  □ Enable TLS (nginx/Caddy reverse proxy) in production  ║
║  □ Restrict MinIO buckets — franchise contracts are PII  ║
║  □ Royalty data = financial PII under PIPEDA Section 7   ║
║  □ Branch employee data — DPDP Act 2023 if India-hosted  ║
║  □ Franchise agreement exports require confirmApprovalId ║
║  □ White-label custom domains — configure DNS + TLS cert ║
║  □ Keycloak realms — one realm per tenant type            ║
║  □ Rotate all secrets post-deployment (Infisical!)        ║
║  □ Corporate wellness employee data — HIPAA/PIPEDA apply  ║
╚══════════════════════════════════════════════════════════╝

To start a single service (e.g. Baserow):
  cd $INSTALL_DIR/baserow && docker compose up -d

To start core services only:
  for svc in twenty keycloak minio baserow metabase; do
    (cd "$INSTALL_DIR/\$svc" && docker compose up -d) || true
  done

SECURITY

info "Wave 20 enterprise tool bootstrap complete — $INSTALL_DIR"
