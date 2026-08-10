#!/usr/bin/env bash
# =============================================================================
# clone-admin.sh — Admin Toolchain Stack
# Refine (CRUD/auth/RBAC), Tabler patterns, AdminLTE, Appsmith, ToolJet,
# NocoDB, Directus, Retool OSS, React-Admin, Forest Admin
# =============================================================================
# Security Policy (blanket, all services):
#   - Never commit API keys, database passwords, or .env to git
#   - Keep all secrets in .env files excluded via .gitignore
#   - Redact PII/secrets before any cloud escalation
#   - PIPEDA / DPDP Act 2023 compliance: admin data is sensitive
# =============================================================================
set -euo pipefail

COMPOSE_DIR="./docker/admin-toolchain"
mkdir -p "$COMPOSE_DIR"

# ─── 1. Appsmith — Low-code internal tools dashboard ─────────────────────────
mkdir -p "$COMPOSE_DIR/appsmith"
cat > "$COMPOSE_DIR/appsmith/docker-compose.yml" << 'EOF'
version: "3.9"
services:
  appsmith:
    image: index.docker.io/appsmith/appsmith-ce:latest
    container_name: appsmith
    restart: unless-stopped
    ports:
      - "8085:80"
      - "8443:443"
    volumes:
      - appsmith_data:/appsmith-stacks
    environment:
      APPSMITH_MONGODB_URI: "mongodb://mongo:27017/appsmith"
      APPSMITH_REDIS_URL: "redis://redis:6379"
    networks:
      - admin_net
  mongo:
    image: mongo:6
    container_name: appsmith_mongo
    restart: unless-stopped
    volumes:
      - appsmith_mongo:/data/db
    networks:
      - admin_net
  redis:
    image: redis:7-alpine
    container_name: appsmith_redis
    restart: unless-stopped
    networks:
      - admin_net
volumes:
  appsmith_data:
  appsmith_mongo:
networks:
  admin_net:
    external: true
EOF
echo "  [✓] Appsmith — http://localhost:8085"

# ─── 2. ToolJet — Open-source low-code admin builder ─────────────────────────
mkdir -p "$COMPOSE_DIR/tooljet"
cat > "$COMPOSE_DIR/tooljet/docker-compose.yml" << 'EOF'
version: "3.9"
services:
  tooljet:
    image: tooljet/tooljet-ce:latest
    container_name: tooljet
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      TOOLJET_HOST: "http://localhost:3000"
      PG_HOST: tooljet_db
      PG_USER: tooljet
      PG_PASS: changeme_tooljet_pass
      PG_DB: tooljet_production
      SECRET_KEY_BASE: "changeme_secret_key_base_32chars++"
    depends_on:
      - tooljet_db
    networks:
      - admin_net
  tooljet_db:
    image: postgres:15-alpine
    container_name: tooljet_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: tooljet
      POSTGRES_PASSWORD: changeme_tooljet_pass
      POSTGRES_DB: tooljet_production
    volumes:
      - tooljet_pg:/var/lib/postgresql/data
    networks:
      - admin_net
volumes:
  tooljet_pg:
networks:
  admin_net:
    external: true
EOF
echo "  [✓] ToolJet — http://localhost:3000"

# ─── 3. NocoDB — Open-source Airtable alternative ────────────────────────────
mkdir -p "$COMPOSE_DIR/nocodb"
cat > "$COMPOSE_DIR/nocodb/docker-compose.yml" << 'EOF'
version: "3.9"
services:
  nocodb:
    image: nocodb/nocodb:latest
    container_name: nocodb
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      NC_DB: "pg://nocodb_pg:5432?u=nocodb&p=changeme_nocodb_pass&d=nocodb_prod"
      NC_AUTH_JWT_SECRET: "changeme_nocodb_jwt_secret"
    depends_on:
      - nocodb_pg
    volumes:
      - nocodb_data:/usr/app/data
    networks:
      - admin_net
  nocodb_pg:
    image: postgres:15-alpine
    container_name: nocodb_pg
    restart: unless-stopped
    environment:
      POSTGRES_USER: nocodb
      POSTGRES_PASSWORD: changeme_nocodb_pass
      POSTGRES_DB: nocodb_prod
    volumes:
      - nocodb_pg:/var/lib/postgresql/data
    networks:
      - admin_net
volumes:
  nocodb_data:
  nocodb_pg:
networks:
  admin_net:
    external: true
EOF
echo "  [✓] NocoDB — http://localhost:8080"

# ─── 4. Directus — API-first headless CMS / admin ────────────────────────────
mkdir -p "$COMPOSE_DIR/directus"
cat > "$COMPOSE_DIR/directus/docker-compose.yml" << 'EOF'
version: "3.9"
services:
  directus:
    image: directus/directus:latest
    container_name: directus
    restart: unless-stopped
    ports:
      - "8055:8055"
    environment:
      SECRET: "changeme_directus_secret"
      DB_CLIENT: "pg"
      DB_HOST: directus_pg
      DB_PORT: "5432"
      DB_DATABASE: directus
      DB_USER: directus
      DB_PASSWORD: changeme_directus_pass
      ADMIN_EMAIL: "admin@studio.local"
      ADMIN_PASSWORD: "changeme_admin_pass"
    depends_on:
      - directus_pg
    volumes:
      - directus_uploads:/directus/uploads
    networks:
      - admin_net
  directus_pg:
    image: postgres:15-alpine
    container_name: directus_pg
    restart: unless-stopped
    environment:
      POSTGRES_USER: directus
      POSTGRES_PASSWORD: changeme_directus_pass
      POSTGRES_DB: directus
    volumes:
      - directus_pg:/var/lib/postgresql/data
    networks:
      - admin_net
volumes:
  directus_uploads:
  directus_pg:
networks:
  admin_net:
    external: true
EOF
echo "  [✓] Directus — http://localhost:8055"

# ─── 5. Grafana — Metrics, dashboards, alerts ────────────────────────────────
mkdir -p "$COMPOSE_DIR/grafana"
cat > "$COMPOSE_DIR/grafana/docker-compose.yml" << 'EOF'
version: "3.9"
services:
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    restart: unless-stopped
    ports:
      - "3030:3000"
    environment:
      GF_SECURITY_ADMIN_USER: admin
      GF_SECURITY_ADMIN_PASSWORD: changeme_grafana_pass
      GF_USERS_ALLOW_SIGN_UP: "false"
    volumes:
      - grafana_data:/var/lib/grafana
    networks:
      - admin_net
volumes:
  grafana_data:
networks:
  admin_net:
    external: true
EOF
echo "  [✓] Grafana — http://localhost:3030"

# ─── 6. Metabase — BI dashboards for business users ──────────────────────────
mkdir -p "$COMPOSE_DIR/metabase"
cat > "$COMPOSE_DIR/metabase/docker-compose.yml" << 'EOF'
version: "3.9"
services:
  metabase:
    image: metabase/metabase:latest
    container_name: metabase
    restart: unless-stopped
    ports:
      - "3031:3000"
    environment:
      MB_DB_TYPE: postgres
      MB_DB_DBNAME: metabase
      MB_DB_PORT: "5432"
      MB_DB_USER: metabase
      MB_DB_PASS: changeme_metabase_pass
      MB_DB_HOST: metabase_pg
    depends_on:
      - metabase_pg
    volumes:
      - metabase_data:/metabase-data
    networks:
      - admin_net
  metabase_pg:
    image: postgres:15-alpine
    container_name: metabase_pg
    restart: unless-stopped
    environment:
      POSTGRES_USER: metabase
      POSTGRES_PASSWORD: changeme_metabase_pass
      POSTGRES_DB: metabase
    volumes:
      - metabase_pg:/var/lib/postgresql/data
    networks:
      - admin_net
volumes:
  metabase_data:
  metabase_pg:
networks:
  admin_net:
    external: true
EOF
echo "  [✓] Metabase — http://localhost:3031"

# ─── 7. Redash — SQL-based reporting ─────────────────────────────────────────
mkdir -p "$COMPOSE_DIR/redash"
cat > "$COMPOSE_DIR/redash/docker-compose.yml" << 'EOF'
version: "3.9"
services:
  redash:
    image: redash/redash:latest
    command: server
    container_name: redash
    restart: unless-stopped
    ports:
      - "5000:5000"
    environment:
      REDASH_DATABASE_URL: "postgresql://redash:changeme_redash_pass@redash_pg/redash"
      REDASH_REDIS_URL: "redis://redash_redis:6379/0"
      REDASH_SECRET_KEY: "changeme_redash_secret"
      REDASH_COOKIE_SECRET: "changeme_redash_cookie"
    depends_on:
      - redash_pg
      - redash_redis
    networks:
      - admin_net
  redash_worker:
    image: redash/redash:latest
    command: worker
    container_name: redash_worker
    restart: unless-stopped
    environment:
      REDASH_DATABASE_URL: "postgresql://redash:changeme_redash_pass@redash_pg/redash"
      REDASH_REDIS_URL: "redis://redash_redis:6379/0"
    depends_on:
      - redash_pg
      - redash_redis
    networks:
      - admin_net
  redash_pg:
    image: postgres:15-alpine
    container_name: redash_pg
    restart: unless-stopped
    environment:
      POSTGRES_USER: redash
      POSTGRES_PASSWORD: changeme_redash_pass
      POSTGRES_DB: redash
    volumes:
      - redash_pg:/var/lib/postgresql/data
    networks:
      - admin_net
  redash_redis:
    image: redis:7-alpine
    container_name: redash_redis
    restart: unless-stopped
    networks:
      - admin_net
volumes:
  redash_pg:
networks:
  admin_net:
    external: true
EOF
echo "  [✓] Redash — http://localhost:5000"

# ─── 8. Budibase — Open-source Retool alternative ────────────────────────────
mkdir -p "$COMPOSE_DIR/budibase"
cat > "$COMPOSE_DIR/budibase/docker-compose.yml" << 'EOF'
version: "3.9"
services:
  budibase:
    image: budibase/budibase:latest
    container_name: budibase
    restart: unless-stopped
    ports:
      - "10000:10000"
    environment:
      JWT_SECRET: "changeme_budibase_jwt"
      MINIO_ACCESS_KEY: "changeme_minio_key"
      MINIO_SECRET_KEY: "changeme_minio_secret"
      COUCH_DB_URL: "http://couchdb:5984"
      REDIS_URL: "redis://budibase_redis:6379"
    depends_on:
      - couchdb
      - budibase_redis
    networks:
      - admin_net
  couchdb:
    image: couchdb:3
    container_name: budibase_couch
    restart: unless-stopped
    environment:
      COUCHDB_USER: admin
      COUCHDB_PASSWORD: changeme_couch_pass
    volumes:
      - budibase_couch:/opt/couchdb/data
    networks:
      - admin_net
  budibase_redis:
    image: redis:7-alpine
    container_name: budibase_redis
    restart: unless-stopped
    networks:
      - admin_net
volumes:
  budibase_couch:
networks:
  admin_net:
    external: true
EOF
echo "  [✓] Budibase — http://localhost:10000"

# ─── 9. AdminLTE — HTML/CSS admin template (static reference) ────────────────
mkdir -p "$COMPOSE_DIR/adminlte"
cat > "$COMPOSE_DIR/adminlte/docker-compose.yml" << 'EOF'
version: "3.9"
services:
  adminlte:
    image: nginx:alpine
    container_name: adminlte
    restart: unless-stopped
    ports:
      - "8090:80"
    volumes:
      - adminlte_www:/usr/share/nginx/html
    networks:
      - admin_net
volumes:
  adminlte_www:
networks:
  admin_net:
    external: true
EOF
echo "  [✓] AdminLTE — http://localhost:8090 (mount dist/ to volume)"

# ─── 10. pgAdmin 4 — PostgreSQL admin panel ──────────────────────────────────
mkdir -p "$COMPOSE_DIR/pgadmin"
cat > "$COMPOSE_DIR/pgadmin/docker-compose.yml" << 'EOF'
version: "3.9"
services:
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: pgadmin
    restart: unless-stopped
    ports:
      - "5050:80"
    environment:
      PGADMIN_DEFAULT_EMAIL: "admin@studio.local"
      PGADMIN_DEFAULT_PASSWORD: "changeme_pgadmin_pass"
    volumes:
      - pgadmin_data:/var/lib/pgadmin
    networks:
      - admin_net
volumes:
  pgadmin_data:
networks:
  admin_net:
    external: true
EOF
echo "  [✓] pgAdmin4 — http://localhost:5050"

# ─── 11. RedisInsight — Redis UI ──────────────────────────────────────────────
mkdir -p "$COMPOSE_DIR/redisinsight"
cat > "$COMPOSE_DIR/redisinsight/docker-compose.yml" << 'EOF'
version: "3.9"
services:
  redisinsight:
    image: redis/redisinsight:latest
    container_name: redisinsight
    restart: unless-stopped
    ports:
      - "5540:5540"
    volumes:
      - redisinsight_data:/data
    networks:
      - admin_net
volumes:
  redisinsight_data:
networks:
  admin_net:
    external: true
EOF
echo "  [✓] RedisInsight — http://localhost:5540"

# ─── 12. Portainer CE — Container management UI ──────────────────────────────
mkdir -p "$COMPOSE_DIR/portainer"
cat > "$COMPOSE_DIR/portainer/docker-compose.yml" << 'EOF'
version: "3.9"
services:
  portainer:
    image: portainer/portainer-ce:latest
    container_name: portainer
    restart: unless-stopped
    ports:
      - "9000:9000"
      - "9443:9443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - portainer_data:/data
    networks:
      - admin_net
volumes:
  portainer_data:
networks:
  admin_net:
    external: true
EOF
echo "  [✓] Portainer CE — http://localhost:9000"

# ─── 13. Infisical — Secret management ───────────────────────────────────────
mkdir -p "$COMPOSE_DIR/infisical"
cat > "$COMPOSE_DIR/infisical/docker-compose.yml" << 'EOF'
version: "3.9"
services:
  infisical:
    image: infisical/infisical:latest
    container_name: infisical
    restart: unless-stopped
    ports:
      - "8200:8080"
    environment:
      ENCRYPTION_KEY: "changeme_infisical_enc_key_32ch+"
      AUTH_SECRET: "changeme_infisical_auth_secret"
      DB_CONNECTION_URI: "mongodb://infisical_mongo:27017/infisical"
    depends_on:
      - infisical_mongo
    networks:
      - admin_net
  infisical_mongo:
    image: mongo:6
    container_name: infisical_mongo
    restart: unless-stopped
    volumes:
      - infisical_mongo:/data/db
    networks:
      - admin_net
volumes:
  infisical_mongo:
networks:
  admin_net:
    external: true
EOF
echo "  [✓] Infisical — http://localhost:8200"

# ─── 14. OpenProject — Project management ────────────────────────────────────
mkdir -p "$COMPOSE_DIR/openproject"
cat > "$COMPOSE_DIR/openproject/docker-compose.yml" << 'EOF'
version: "3.9"
services:
  openproject:
    image: openproject/community:latest
    container_name: openproject
    restart: unless-stopped
    ports:
      - "8095:80"
    environment:
      OPENPROJECT_SECRET_KEY_BASE: "changeme_op_secret_key"
      OPENPROJECT_HTTPS: "false"
      DATABASE_URL: "postgresql://openproject:changeme_op_pass@op_pg/openproject"
    depends_on:
      - op_pg
    volumes:
      - op_data:/var/openproject/assets
    networks:
      - admin_net
  op_pg:
    image: postgres:15-alpine
    container_name: op_pg
    restart: unless-stopped
    environment:
      POSTGRES_USER: openproject
      POSTGRES_PASSWORD: changeme_op_pass
      POSTGRES_DB: openproject
    volumes:
      - op_pg:/var/lib/postgresql/data
    networks:
      - admin_net
volumes:
  op_data:
  op_pg:
networks:
  admin_net:
    external: true
EOF
echo "  [✓] OpenProject — http://localhost:8095"

# ─── 15. Wiki.js — Internal knowledge base / admin docs ─────────────────────
mkdir -p "$COMPOSE_DIR/wikijs"
cat > "$COMPOSE_DIR/wikijs/docker-compose.yml" << 'EOF'
version: "3.9"
services:
  wiki:
    image: ghcr.io/requarks/wiki:2
    container_name: wikijs
    restart: unless-stopped
    ports:
      - "3010:3000"
    environment:
      DB_TYPE: postgres
      DB_HOST: wiki_pg
      DB_PORT: "5432"
      DB_NAME: wiki
      DB_USER: wiki
      DB_PASS: changeme_wiki_pass
    depends_on:
      - wiki_pg
    networks:
      - admin_net
  wiki_pg:
    image: postgres:15-alpine
    container_name: wiki_pg
    restart: unless-stopped
    environment:
      POSTGRES_USER: wiki
      POSTGRES_PASSWORD: changeme_wiki_pass
      POSTGRES_DB: wiki
    volumes:
      - wiki_pg:/var/lib/postgresql/data
    networks:
      - admin_net
volumes:
  wiki_pg:
networks:
  admin_net:
    external: true
EOF
echo "  [✓] Wiki.js — http://localhost:3010"

# ─── Create shared Docker network ─────────────────────────────────────────────
echo ""
echo "Creating shared Docker network..."
docker network inspect admin_net >/dev/null 2>&1 || docker network create admin_net
echo "  [✓] admin_net network ready"

# ─── Summary ──────────────────────────────────────────────────────────────────
cat << 'SUMMARY'

╔══════════════════════════════════════════════════════════════════╗
║              Admin Toolchain — Port Map                          ║
╠══════════════════════════════════════════════════════════════════╣
║  Appsmith        http://localhost:8085   Low-code internal tools ║
║  ToolJet         http://localhost:3000   Low-code admin builder  ║
║  NocoDB          http://localhost:8080   Airtable alternative    ║
║  Directus        http://localhost:8055   Headless CMS / admin    ║
║  Grafana         http://localhost:3030   Metrics & alerts        ║
║  Metabase        http://localhost:3031   BI dashboards           ║
║  Redash          http://localhost:5000   SQL reporting           ║
║  Budibase        http://localhost:10000  Retool alternative      ║
║  AdminLTE        http://localhost:8090   HTML template ref.      ║
║  pgAdmin 4       http://localhost:5050   PostgreSQL admin        ║
║  RedisInsight    http://localhost:5540   Redis UI                ║
║  Portainer CE    http://localhost:9000   Container management    ║
║  Infisical       http://localhost:8200   Secret management       ║
║  OpenProject     http://localhost:8095   Project management      ║
║  Wiki.js         http://localhost:3010   Knowledge base          ║
╠══════════════════════════════════════════════════════════════════╣
║  SECURITY: Replace all "changeme_*" values with strong secrets  ║
║            in .env files BEFORE first start.                    ║
║  Never commit .env, passwords, or API keys to git.              ║
╚══════════════════════════════════════════════════════════════════╝

NOTE on Refine + Tabler (frontend):
  - Refine (https://refine.dev): Install as Next.js package:
      npm install @refinedev/core @refinedev/nextjs-router @refinedev/simple-rest
    Provides: CRUD pages, auth, RBAC, data-provider layer
  - Tabler (https://tabler.io): Use for design inspiration only
    (Tabler uses Bootstrap CSS which conflicts with Tailwind)
    Import icon components: npm install @tabler/icons-react

SUMMARY

echo "Admin toolchain compose files written to: $COMPOSE_DIR"
echo "Start individual service: docker compose -f $COMPOSE_DIR/<service>/docker-compose.yml up -d"
