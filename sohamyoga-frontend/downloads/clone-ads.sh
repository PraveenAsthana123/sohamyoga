#!/usr/bin/env bash
# Wave 15 — Google Ads-like Platform: clone + setup open-source stack
# Run from the project root: bash downloads/clone-ads.sh
# Requires: git, docker, node >= 20, python >= 3.10 (for ComfyUI/Ollama)

set -euo pipefail

SERVICES_DIR="$(pwd)/services/ads"
mkdir -p "$SERVICES_DIR"

echo ""
echo "=== Wave 15: Google Ads-like Stack Clone ==="
echo "Target: $SERVICES_DIR"
echo ""

# ─── 1. Revive Adserver ───────────────────────────────────────────────────────
echo "[1/11] Revive Adserver (self-hosted ad server)"
if [ ! -d "$SERVICES_DIR/revive-adserver" ]; then
  git clone --depth 1 https://github.com/revive-adserver/revive-adserver.git "$SERVICES_DIR/revive-adserver"
else
  echo "  → already cloned, skipping"
fi

# ─── 2. Prebid.js ─────────────────────────────────────────────────────────────
echo "[2/11] Prebid.js (browser-side header bidding)"
if [ ! -d "$SERVICES_DIR/prebid.js" ]; then
  git clone --depth 1 https://github.com/prebid/Prebid.js.git "$SERVICES_DIR/prebid.js"
else
  echo "  → already cloned, skipping"
fi

# ─── 3. Prebid Server ─────────────────────────────────────────────────────────
echo "[3/11] Prebid Server (server-side header bidding)"
if [ ! -d "$SERVICES_DIR/prebid-server" ]; then
  git clone --depth 1 https://github.com/prebid/prebid-server.git "$SERVICES_DIR/prebid-server"
else
  echo "  → already cloned, skipping"
fi

# ─── 4. ComfyUI (image generation) ───────────────────────────────────────────
echo "[4/11] ComfyUI (AI image/banner generation)"
if [ ! -d "$SERVICES_DIR/ComfyUI" ]; then
  git clone --depth 1 https://github.com/comfyanonymous/ComfyUI.git "$SERVICES_DIR/ComfyUI"
else
  echo "  → already cloned, skipping"
fi

# ─── 5. GrowthBook (A/B testing) ─────────────────────────────────────────────
echo "[5/11] GrowthBook (A/B testing + feature flags)"
if [ ! -d "$SERVICES_DIR/growthbook" ]; then
  git clone --depth 1 https://github.com/growthbook/growthbook.git "$SERVICES_DIR/growthbook"
else
  echo "  → already cloned, skipping"
fi

# ─── 6. Listmonk (email marketing) ───────────────────────────────────────────
echo "[6/11] Listmonk (email campaign management)"
if [ ! -d "$SERVICES_DIR/listmonk" ]; then
  git clone --depth 1 https://github.com/knadh/listmonk.git "$SERVICES_DIR/listmonk"
else
  echo "  → already cloned, skipping"
fi

# ─── 7. Postiz (social media publishing) ─────────────────────────────────────
echo "[7/11] Postiz (social media publishing — 14+ platforms)"
if [ ! -d "$SERVICES_DIR/postiz" ]; then
  git clone --depth 1 https://github.com/gitroomhq/postiz-app.git "$SERVICES_DIR/postiz"
else
  echo "  → already cloned, skipping"
fi

# ─── 8. Activepieces (automation) ────────────────────────────────────────────
echo "[8/11] Activepieces (workflow automation)"
if [ ! -d "$SERVICES_DIR/activepieces" ]; then
  git clone --depth 1 https://github.com/activepieces/activepieces.git "$SERVICES_DIR/activepieces"
else
  echo "  → already cloned, skipping"
fi

# ─── 9. PostHog (analytics) ──────────────────────────────────────────────────
echo "[9/11] PostHog (analytics — shared with Wave 13)"
if [ ! -d "$SERVICES_DIR/posthog" ]; then
  git clone --depth 1 https://github.com/PostHog/posthog.git "$SERVICES_DIR/posthog"
else
  echo "  → already cloned, skipping"
fi

# ─── 10. Grafana (ROAS dashboards) ───────────────────────────────────────────
echo "[10/11] Grafana (ROAS, spend, CTR dashboards)"
if [ ! -d "$SERVICES_DIR/grafana" ]; then
  git clone --depth 1 https://github.com/grafana/grafana.git "$SERVICES_DIR/grafana"
else
  echo "  → already cloned, skipping"
fi

# ─── 11. OpenRTB examples ─────────────────────────────────────────────────────
echo "[11/11] Kevel OpenRTB examples (RTB reference)"
if [ ! -d "$SERVICES_DIR/openrtb-examples" ]; then
  git clone --depth 1 https://github.com/kevelai/openrtb-examples.git "$SERVICES_DIR/openrtb-examples" 2>/dev/null \
    || echo "  → openrtb-examples not available, skipping"
else
  echo "  → already cloned, skipping"
fi

# ─── docker-compose.ads.yml ───────────────────────────────────────────────────
COMPOSE_FILE="$(pwd)/docker-compose.ads.yml"
if [ ! -f "$COMPOSE_FILE" ]; then
  cat > "$COMPOSE_FILE" <<'YAML'
# Wave 15: Google Ads-like Platform — docker-compose
# Usage: docker compose -f docker-compose.ads.yml up -d

services:

  revive-adserver:
    image: reviveadserver/revive-adserver:latest
    ports:
      - "8080:80"
    environment:
      - REVIVE_DB_HOST=postgres-ads
      - REVIVE_DB_NAME=revive
      - REVIVE_DB_USER=revive
      - REVIVE_DB_PASS=revive_password
    depends_on:
      - postgres-ads

  growthbook:
    image: growthbook/growthbook:latest
    ports:
      - "3300:3000"
      - "3301:3100"
    environment:
      - MONGODB_URI=mongodb://mongo-ads:27017/growthbook
      - APP_ORIGIN=http://localhost:3300
      - API_HOST=http://localhost:3301

  listmonk:
    image: listmonk/listmonk:latest
    ports:
      - "9000:9000"
    environment:
      - LISTMONK_db__host=postgres-ads
      - LISTMONK_db__port=5432
      - LISTMONK_db__user=listmonk
      - LISTMONK_db__password=listmonk_password
      - LISTMONK_db__database=listmonk
    depends_on:
      - postgres-ads

  postgres-ads:
    image: postgres:16
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - postgres_ads_data:/var/lib/postgresql/data
      - ./services/ads/init.sql:/docker-entrypoint-initdb.d/init.sql

  mongo-ads:
    image: mongo:7
    volumes:
      - mongo_ads_data:/data/db

volumes:
  postgres_ads_data:
  mongo_ads_data:
YAML
  echo "Created: docker-compose.ads.yml"
fi

# ─── .env.ads.example ─────────────────────────────────────────────────────────
ENV_FILE="$(pwd)/.env.ads.example"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<'ENV'
# Wave 15: Google Ads-like Platform — environment variables
# Copy to .env.local and fill in real values

# Revive Adserver
REVIVE_API_URL=http://localhost:8080
REVIVE_API_KEY=

# GrowthBook
GROWTHBOOK_API_HOST=http://localhost:3301
GROWTHBOOK_CLIENT_KEY=
GROWTHBOOK_SECRET_KEY=

# Listmonk (email campaigns)
LISTMONK_URL=http://localhost:9000
LISTMONK_USERNAME=listmonk
LISTMONK_PASSWORD=

# Postiz (social media)
POSTIZ_URL=http://localhost:5000

# Activepieces (automation)
ACTIVEPIECES_URL=http://localhost:8070

# PostHog (shared with Wave 13)
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=http://localhost:8000

# ComfyUI (image generation)
COMFYUI_URL=http://localhost:8188

# Google Ads API (optional — for managing real Google Ads)
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_CUSTOMER_ID=

# Ollama (shared with other waves)
OLLAMA_BASE_URL=http://localhost:11434
ENV
  echo "Created: .env.ads.example"
fi

echo ""
echo "=== Wave 15 Clone Complete ==="
echo ""
echo "Services cloned to: $SERVICES_DIR"
echo ""
echo "Quick start:"
echo "  docker compose -f docker-compose.ads.yml up -d"
echo ""
echo "Then:"
echo "  1. Visit http://localhost:8080 — Revive Adserver setup"
echo "  2. Visit http://localhost:3300 — GrowthBook dashboard"
echo "  3. Visit http://localhost:9000 — Listmonk email campaigns"
echo "  4. Copy API keys → .env.local"
echo ""
echo "ComfyUI (GPU required):"
echo "  cd services/ads/ComfyUI && pip install -r requirements.txt && python main.py --listen"
echo ""
echo "Feature flags (Wave 15):"
echo "  ads.campaigns        = enabled"
echo "  ads.ai_copy          = enabled"
echo "  ads.image_generation = enabled (requires ComfyUI)"
echo "  ads.header_bidding   = disabled (rollout 0%)"
echo "  ads.google_ads_sync  = disabled (rollout 0%)"
echo ""
