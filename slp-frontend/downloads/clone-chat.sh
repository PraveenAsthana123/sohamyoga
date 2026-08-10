#!/usr/bin/env bash
# Wave 14 — B2C Chat Module: clone + setup open-source stack
# Run from the project root: bash downloads/clone-chat.sh
# Requires: git, docker, node >= 20

set -euo pipefail

SERVICES_DIR="$(pwd)/services/chat"
mkdir -p "$SERVICES_DIR"

echo ""
echo "=== Wave 14: B2C Chat Stack Clone ==="
echo "Target: $SERVICES_DIR"
echo ""

# ─── 1. Chatwoot ──────────────────────────────────────────────────────────────
echo "[1/12] Chatwoot (customer messaging platform)"
if [ ! -d "$SERVICES_DIR/chatwoot" ]; then
  git clone --depth 1 https://github.com/chatwoot/chatwoot.git "$SERVICES_DIR/chatwoot"
else
  echo "  → already cloned, skipping"
fi

# ─── 2. Papercups (alternative to Chatwoot) ───────────────────────────────────
echo "[2/12] Papercups (Chatwoot alternative)"
if [ ! -d "$SERVICES_DIR/papercups" ]; then
  git clone --depth 1 https://github.com/papercups-io/papercups.git "$SERVICES_DIR/papercups"
else
  echo "  → already cloned, skipping"
fi

# ─── 3. Open WebUI ────────────────────────────────────────────────────────────
echo "[3/12] Open WebUI (Ollama chat interface)"
if [ ! -d "$SERVICES_DIR/open-webui" ]; then
  git clone --depth 1 https://github.com/open-webui/open-webui.git "$SERVICES_DIR/open-webui"
else
  echo "  → already cloned, skipping"
fi

# ─── 4. LangGraph ─────────────────────────────────────────────────────────────
echo "[4/12] LangGraph (AI workflow orchestration)"
if [ ! -d "$SERVICES_DIR/langgraph" ]; then
  git clone --depth 1 https://github.com/langchain-ai/langgraph.git "$SERVICES_DIR/langgraph"
else
  echo "  → already cloned, skipping"
fi

# ─── 5. LlamaIndex ────────────────────────────────────────────────────────────
echo "[5/12] LlamaIndex (RAG / knowledge retrieval)"
if [ ! -d "$SERVICES_DIR/llama_index" ]; then
  git clone --depth 1 https://github.com/run-llama/llama_index.git "$SERVICES_DIR/llama_index"
else
  echo "  → already cloned, skipping"
fi

# ─── 6. Qdrant ────────────────────────────────────────────────────────────────
echo "[6/12] Qdrant (vector database)"
if [ ! -d "$SERVICES_DIR/qdrant" ]; then
  git clone --depth 1 https://github.com/qdrant/qdrant.git "$SERVICES_DIR/qdrant"
else
  echo "  → already cloned, skipping"
fi

# ─── 7. LiveKit ───────────────────────────────────────────────────────────────
echo "[7/12] LiveKit (voice & video / WebRTC)"
if [ ! -d "$SERVICES_DIR/livekit" ]; then
  git clone --depth 1 https://github.com/livekit/livekit.git "$SERVICES_DIR/livekit"
else
  echo "  → already cloned, skipping"
fi

# ─── 8. Novu ──────────────────────────────────────────────────────────────────
echo "[8/12] Novu (notification orchestration)"
if [ ! -d "$SERVICES_DIR/novu" ]; then
  git clone --depth 1 https://github.com/novuhq/novu.git "$SERVICES_DIR/novu"
else
  echo "  → already cloned, skipping"
fi

# ─── 9. Flowise (visual LLM builder) ─────────────────────────────────────────
echo "[9/12] Flowise (visual LangChain / LLM builder)"
if [ ! -d "$SERVICES_DIR/flowise" ]; then
  git clone --depth 1 https://github.com/FlowiseAI/Flowise.git "$SERVICES_DIR/flowise"
else
  echo "  → already cloned, skipping"
fi

# ─── 10. Activepieces (no-code automation) ───────────────────────────────────
echo "[10/12] Activepieces (automation / workflow triggers)"
if [ ! -d "$SERVICES_DIR/activepieces" ]; then
  git clone --depth 1 https://github.com/activepieces/activepieces.git "$SERVICES_DIR/activepieces"
else
  echo "  → already cloned, skipping"
fi

# ─── 11. PostHog (chat analytics) ────────────────────────────────────────────
echo "[11/12] PostHog (analytics, funnels, session replay)"
if [ ! -d "$SERVICES_DIR/posthog" ]; then
  git clone --depth 1 https://github.com/PostHog/posthog.git "$SERVICES_DIR/posthog"
else
  echo "  → already cloned, skipping"
fi

# ─── 12. Haystack (alternative RAG pipeline) ─────────────────────────────────
echo "[12/12] Haystack (alternative RAG / NLP pipeline)"
if [ ! -d "$SERVICES_DIR/haystack" ]; then
  git clone --depth 1 https://github.com/deepset-ai/haystack.git "$SERVICES_DIR/haystack"
else
  echo "  → already cloned, skipping"
fi

# ─── docker-compose.chat.yml ──────────────────────────────────────────────────
COMPOSE_FILE="$(pwd)/docker-compose.chat.yml"
if [ ! -f "$COMPOSE_FILE" ]; then
  cat > "$COMPOSE_FILE" <<'YAML'
# Wave 14: B2C Chat Module — docker-compose
# Usage: docker compose -f docker-compose.chat.yml up -d

services:

  chatwoot:
    image: chatwoot/chatwoot:latest
    ports:
      - "3100:3000"
    environment:
      - SECRET_KEY_BASE=changeme_secret_key_base_min_64_chars_xxxxxxxxxxxxxxxxxxxxxxxxxx
      - FRONTEND_URL=http://localhost:3100
      - POSTGRES_HOST=postgres
      - POSTGRES_DATABASE=chatwoot
      - POSTGRES_USERNAME=postgres
      - POSTGRES_PASSWORD=postgres
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    command: bundle exec rails s -p 3000 -b 0.0.0.0

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage

  livekit:
    image: livekit/livekit-server:latest
    ports:
      - "7880:7880"
      - "7881:7881/udp"
    command: --dev --bind 0.0.0.0

  novu:
    image: ghcr.io/novuhq/novu:latest
    ports:
      - "3002:3000"
    environment:
      - MONGO_URL=mongodb://mongo:27017/novu
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=changeme_jwt_secret
    depends_on:
      - mongo
      - redis

  postgres:
    image: postgres:16
    environment:
      - POSTGRES_DB=chatwoot
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - postgres_chat_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_chat_data:/data

  mongo:
    image: mongo:7
    volumes:
      - mongo_data:/data/db

volumes:
  qdrant_data:
  postgres_chat_data:
  redis_chat_data:
  mongo_data:
YAML
  echo ""
  echo "Created: docker-compose.chat.yml"
fi

# ─── .env.chat.example ────────────────────────────────────────────────────────
ENV_FILE="$(pwd)/.env.chat.example"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<'ENV'
# Wave 14: B2C Chat — environment variables
# Copy to .env.local and fill in real values

# Chatwoot
CHATWOOT_API_URL=http://localhost:3100
CHATWOOT_API_TOKEN=
CHATWOOT_ACCOUNT_ID=1
NEXT_PUBLIC_CHATWOOT_TOKEN=
NEXT_PUBLIC_CHATWOOT_URL=http://localhost:3100

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=slp_chat_kb

# LlamaIndex / RAG
LLAMAINDEX_EMBED_MODEL=bge-small-en-v1.5

# LangGraph
LANGGRAPH_API_URL=http://localhost:8080

# LiveKit
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret

# Novu
NOVU_API_KEY=
NOVU_API_URL=http://localhost:3002

# Ollama (shared with Wave 13 analytics)
OLLAMA_BASE_URL=http://localhost:11434
ENV
  echo "Created: .env.chat.example"
fi

echo ""
echo "=== Wave 14 Clone Complete ==="
echo ""
echo "Services cloned to: $SERVICES_DIR"
echo ""
echo "Quick start:"
echo "  docker compose -f docker-compose.chat.yml up -d"
echo ""
echo "Then:"
echo "  1. Visit http://localhost:3100 — Chatwoot setup wizard"
echo "  2. Copy widget token → NEXT_PUBLIC_CHATWOOT_TOKEN in .env.local"
echo "  3. Copy API token → CHATWOOT_API_TOKEN in .env.local"
echo "  4. Visit http://localhost:6333/dashboard — Qdrant"
echo "  5. Visit http://localhost:3002 — Novu"
echo ""
echo "Feature flags (Wave 14):"
echo "  chat.live_chat        = enabled"
echo "  chat.ai_bot           = enabled"
echo "  chat.voice_messages   = disabled (rollout 0%)"
echo "  chat.video_consultation = disabled (rollout 0%)"
echo ""
