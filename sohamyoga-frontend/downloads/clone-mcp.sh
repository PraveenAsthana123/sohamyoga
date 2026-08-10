#!/usr/bin/env bash
# clone-mcp.sh — Clone MCP SDK, reference implementations, and community adapters
# Run from the project root: bash downloads/clone-mcp.sh [target-dir]
set -euo pipefail

TARGET_DIR="${1:-downloads/mcp-repos}"
mkdir -p "$TARGET_DIR"

clone_if_missing() {
  local url="$1" dir="$2"
  if [ -d "$dir/.git" ]; then
    echo "  [skip] $dir already cloned"
  else
    echo "  → Cloning $url into $dir"
    git clone --depth 1 "$url" "$dir"
  fi
}

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  MCP SDK and Reference Implementations                          ║"
echo "╚══════════════════════════════════════════════════════════════════╝"

# ── Core SDK ──────────────────────────────────────────────────────────────────

echo ""
echo "── MCP TypeScript SDK (Anthropic) ───────────────────────────────"
clone_if_missing \
  "https://github.com/modelcontextprotocol/typescript-sdk" \
  "$TARGET_DIR/mcp-typescript-sdk"

echo ""
echo "── MCP Python SDK ───────────────────────────────────────────────"
clone_if_missing \
  "https://github.com/modelcontextprotocol/python-sdk" \
  "$TARGET_DIR/mcp-python-sdk"

echo ""
echo "── MCP Servers (Anthropic reference implementations) ────────────"
clone_if_missing \
  "https://github.com/modelcontextprotocol/servers" \
  "$TARGET_DIR/mcp-servers-reference"

# ── Community MCP adapters for backing services ───────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  Community MCP Adapters — Review Before Use in Production       ║"
echo "╚══════════════════════════════════════════════════════════════════╝"

echo ""
echo "── PostHog MCP ──────────────────────────────────────────────────"
# NOTE: evaluate security before enabling in production (analytics-mcp)
clone_if_missing \
  "https://github.com/PostHog/posthog-mcp" \
  "$TARGET_DIR/posthog-mcp"

echo ""
echo "── LlamaIndex (RAG / knowledge-mcp) ─────────────────────────────"
clone_if_missing \
  "https://github.com/run-llama/llama_index" \
  "$TARGET_DIR/llama-index"

echo ""
echo "── Paperless-ngx Community MCP (content-mcp) ────────────────────"
# Community adapter — verify auth model and injection risk before adopting
clone_if_missing \
  "https://github.com/tjbck/paperless-ngx-mcp" \
  "$TARGET_DIR/paperless-ngx-mcp" 2>/dev/null || echo "  [warn] paperless-ngx-mcp not found — search GitHub for current adapter"

echo ""
echo "── Temporal TypeScript SDK (workflow-mcp) ────────────────────────"
clone_if_missing \
  "https://github.com/temporalio/sdk-typescript" \
  "$TARGET_DIR/temporal-ts-sdk"

echo ""
echo "── Prometheus Client Node.js (admin-mcp) ─────────────────────────"
clone_if_missing \
  "https://github.com/siimon/prom-client" \
  "$TARGET_DIR/prom-client"

# ── Identity, Auth, QR ────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  Identity, Auth, and QR/Barcode Libraries                       ║"
echo "╚══════════════════════════════════════════════════════════════════╝"

echo ""
echo "── Keycloak ─────────────────────────────────────────────────────"
clone_if_missing \
  "https://github.com/keycloak/keycloak" \
  "$TARGET_DIR/keycloak"

echo ""
echo "── Keycloak Quickstarts ─────────────────────────────────────────"
clone_if_missing \
  "https://github.com/keycloak/keycloak-quickstarts" \
  "$TARGET_DIR/keycloak-quickstarts"

echo ""
echo "── html5-qrcode (QR scanner) ────────────────────────────────────"
clone_if_missing \
  "https://github.com/mebjas/html5-qrcode" \
  "$TARGET_DIR/html5-qrcode"

echo ""
echo "── qr-code-styling (QR generation) ─────────────────────────────"
clone_if_missing \
  "https://github.com/kozakdenys/qr-code-styling" \
  "$TARGET_DIR/qr-code-styling"

echo ""
echo "── quagga2 (barcode scanner) ────────────────────────────────────"
clone_if_missing \
  "https://github.com/ericblade/quagga2" \
  "$TARGET_DIR/quagga2"

# ── CRM, Workflow, and Marketing ──────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  CRM, Workflow, and Marketing Stacks                            ║"
echo "╚══════════════════════════════════════════════════════════════════╝"

echo ""
echo "── Frappe CRM ───────────────────────────────────────────────────"
clone_if_missing \
  "https://github.com/frappe/crm" \
  "$TARGET_DIR/frappe-crm"

echo ""
echo "── Formbricks (lead forms) ──────────────────────────────────────"
clone_if_missing \
  "https://github.com/formbricks/formbricks" \
  "$TARGET_DIR/formbricks"

echo ""
echo "── Activepieces (workflow automation) ───────────────────────────"
clone_if_missing \
  "https://github.com/activepieces/activepieces" \
  "$TARGET_DIR/activepieces"

echo ""
echo "── Postiz (social media scheduler) ─────────────────────────────"
clone_if_missing \
  "https://github.com/gitroomhq/postiz-app" \
  "$TARGET_DIR/postiz"

echo ""
echo "── Listmonk (email campaigns) ───────────────────────────────────"
clone_if_missing \
  "https://github.com/knadh/listmonk" \
  "$TARGET_DIR/listmonk"

echo ""
echo "── Novu (notification infrastructure) ───────────────────────────"
clone_if_missing \
  "https://github.com/novuhq/novu" \
  "$TARGET_DIR/novu"

# ── Event / Booking ───────────────────────────────────────────────────────────

echo ""
echo "── Hi.Events (event + QR ticketing reference) ───────────────────"
clone_if_missing \
  "https://github.com/HiEventsDev/hi.events" \
  "$TARGET_DIR/hi-events"

echo ""
echo "── Cal.com (class scheduling) ───────────────────────────────────"
clone_if_missing \
  "https://github.com/calcom/cal.com" \
  "$TARGET_DIR/cal-com"

# ── Learning ──────────────────────────────────────────────────────────────────

echo ""
echo "── Frappe Education ─────────────────────────────────────────────"
clone_if_missing \
  "https://github.com/frappe/education" \
  "$TARGET_DIR/frappe-education"

# ── Content ───────────────────────────────────────────────────────────────────

echo ""
echo "── Ghost CMS ────────────────────────────────────────────────────"
clone_if_missing \
  "https://github.com/TryGhost/Ghost" \
  "$TARGET_DIR/ghost"

echo ""
echo "── PeerTube (video hosting) ─────────────────────────────────────"
clone_if_missing \
  "https://github.com/Chocobozzz/PeerTube" \
  "$TARGET_DIR/peertube"

echo ""
echo "── Paperless-ngx (document management) ─────────────────────────"
clone_if_missing \
  "https://github.com/paperless-ngx/paperless-ngx" \
  "$TARGET_DIR/paperless-ngx"

# ── Knowledge / Search ────────────────────────────────────────────────────────

echo ""
echo "── Qdrant (vector store) ────────────────────────────────────────"
clone_if_missing \
  "https://github.com/qdrant/qdrant" \
  "$TARGET_DIR/qdrant"

echo ""
echo "── Meilisearch ──────────────────────────────────────────────────"
clone_if_missing \
  "https://github.com/meilisearch/meilisearch" \
  "$TARGET_DIR/meilisearch"

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  Done. All repos cloned to: $TARGET_DIR"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. Review community MCP adapters (PostHog, Paperless-ngx) before production use"
echo "  2. Run: cd $TARGET_DIR/mcp-typescript-sdk && npm install && npm run build"
echo "  3. Study mcp-servers-reference for gateway adapter patterns"
echo "  4. Keep all repos in downloads/ — .gitignore excludes them from git history"
