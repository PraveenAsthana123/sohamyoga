#!/bin/sh
# Seeds all SLP portal secrets into OpenBao at startup.
# Values read from environment — set them in .env before running.
# Run once: docker compose -f docker-compose.openbao.yml run openbao-init

set -e
export BAO_ADDR=${BAO_ADDR:-http://openbao:8200}

echo "==> Enabling KV secrets engine..."
bao secrets enable -path=slp-portal kv-v2 2>/dev/null || echo "already enabled"

echo "==> Writing portal secrets..."

# Database
bao kv put slp-portal/database \
  url="${DATABASE_URL}" \
  host="${DB_HOST}" \
  port="${DB_PORT:-5432}" \
  name="${DB_NAME}" \
  user="${DB_USER}" \
  password="${DB_PASSWORD}"

# Ollama
bao kv put slp-portal/ollama \
  base_url="${OLLAMA_BASE_URL:-http://host.docker.internal:11434}" \
  model_fast="${OLLAMA_MODEL_FAST:-phi3:mini}" \
  model_strong="${OLLAMA_MODEL_STRONG:-llama3.2:latest}"

# Nango (OAuth manager)
bao kv put slp-portal/nango \
  secret_key="${NANGO_SECRET_KEY}" \
  public_key="${NANGO_PUBLIC_KEY}" \
  base_url="${NANGO_BASE_URL:-http://nango:3003}"

# Postiz (social publishing)
bao kv put slp-portal/postiz \
  client_url="${POSTIZ_CLIENT_URL:-http://postiz:3000}" \
  api_key="${POSTIZ_API_KEY}"

# Novu (notifications)
bao kv put slp-portal/novu \
  api_key="${NOVU_API_KEY}" \
  base_url="${NOVU_BASE_URL:-http://novu:3000}"

# Listmonk (email)
bao kv put slp-portal/listmonk \
  base_url="${LISTMONK_BASE_URL:-http://listmonk:9000}" \
  username="${LISTMONK_USERNAME:-listmonk}" \
  password="${LISTMONK_PASSWORD}"

# Mautic (marketing automation)
bao kv put slp-portal/mautic \
  base_url="${MAUTIC_BASE_URL:-http://mautic:8888}" \
  user="${MAUTIC_USER}" \
  password="${MAUTIC_PASSWORD}"

# Matomo (analytics)
bao kv put slp-portal/matomo \
  base_url="${MATOMO_BASE_URL:-http://matomo:8080}" \
  site_id="${MATOMO_SITE_ID:-1}" \
  auth_token="${MATOMO_AUTH_TOKEN}"

# Keycloak (identity)
bao kv put slp-portal/keycloak \
  base_url="${KEYCLOAK_BASE_URL:-http://keycloak:8080}" \
  realm="${KEYCLOAK_REALM:-slp}" \
  client_id="${KEYCLOAK_CLIENT_ID}" \
  client_secret="${KEYCLOAK_CLIENT_SECRET}"

# Activepieces / n8n
bao kv put slp-portal/activepieces \
  base_url="${ACTIVEPIECES_BASE_URL:-http://activepieces:80}" \
  api_key="${ACTIVEPIECES_API_KEY}"

bao kv put slp-portal/n8n \
  base_url="${N8N_BASE_URL:-http://n8n:5678}" \
  api_key="${N8N_API_KEY}"

echo "==> All secrets seeded into OpenBao ✓"
echo "    Access: bao kv get slp-portal/nango"
echo "    UI: http://localhost:8200"
