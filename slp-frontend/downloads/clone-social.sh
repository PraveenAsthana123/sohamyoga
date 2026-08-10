#!/usr/bin/env bash
# clone-social.sh — Clone all repositories for the Social Media MCP portal
# Architecture: Postiz + Postiz MCP + Nango + Activepieces + MCP TypeScript SDK
# Run: bash downloads/clone-social.sh [target-dir]
set -euo pipefail

TARGET_DIR="${1:-downloads/social-repos}"
mkdir -p "$TARGET_DIR"

clone_if_missing() {
  local url="$1" dir="$2"
  if [ -d "$dir/.git" ]; then
    echo "  [skip] $dir already cloned"
  else
    echo "  → Cloning $url"
    git clone --depth 1 "$url" "$dir"
  fi
}

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  Social Media MCP Portal — Repository Setup                     ║"
echo "║  Postiz + Postiz MCP + Nango + MCP SDK + Activepieces           ║"
echo "╚══════════════════════════════════════════════════════════════════╝"

# ── Core social scheduling platform ──────────────────────────────────────────

echo ""
echo "── Postiz (social scheduling — main application) ────────────────"
echo "   Supports: Facebook, Instagram, LinkedIn, X, Threads, TikTok,"
echo "   YouTube, Reddit, Pinterest, Bluesky, Mastodon, Discord, Slack"
clone_if_missing \
  "https://github.com/gitroomhq/postiz-app" \
  "$TARGET_DIR/postiz"

echo ""
echo "── Postiz MCP (AI/MCP control layer for Postiz) ─────────────────"
echo "   Exposes Postiz actions as MCP tools for AI agent control"
clone_if_missing \
  "https://github.com/antoniolg/postiz-mcp" \
  "$TARGET_DIR/postiz-mcp"

# ── MCP SDK and infrastructure ────────────────────────────────────────────────

echo ""
echo "── MCP TypeScript SDK (custom connector foundation) ─────────────"
clone_if_missing \
  "https://github.com/modelcontextprotocol/typescript-sdk" \
  "$TARGET_DIR/mcp-typescript-sdk"

echo ""
echo "── MCP Python SDK ───────────────────────────────────────────────"
clone_if_missing \
  "https://github.com/modelcontextprotocol/python-sdk" \
  "$TARGET_DIR/mcp-python-sdk"

echo ""
echo "── MCP Reference Servers (educational — not production) ─────────"
clone_if_missing \
  "https://github.com/modelcontextprotocol/servers" \
  "$TARGET_DIR/mcp-servers-reference"

# ── OAuth and token management ────────────────────────────────────────────────

echo ""
echo "── Nango (OAuth token storage, refresh, API integrations) ───────"
echo "   Handles OAuth for all 16 platforms. Refreshes tokens before expiry."
clone_if_missing \
  "https://github.com/NangoHQ/nango" \
  "$TARGET_DIR/nango"

# ── Workflow and approval automation ─────────────────────────────────────────

echo ""
echo "── Activepieces (approval workflows, triggers, automation) ──────"
clone_if_missing \
  "https://github.com/activepieces/activepieces" \
  "$TARGET_DIR/activepieces"

echo ""
echo "── Temporal TypeScript SDK (durable scheduling, retries) ────────"
echo "   Reliable long-running posting workflows with guaranteed delivery"
clone_if_missing \
  "https://github.com/temporalio/sdk-typescript" \
  "$TARGET_DIR/temporal-ts-sdk"

# ── Local AI for content generation ──────────────────────────────────────────

echo ""
echo "── Ollama (local caption/hashtag/translation generation) ────────"
clone_if_missing \
  "https://github.com/ollama/ollama" \
  "$TARGET_DIR/ollama"

echo ""
echo "── LangGraph (agent orchestration for content planning) ─────────"
clone_if_missing \
  "https://github.com/langchain-ai/langgraph" \
  "$TARGET_DIR/langgraph"

# ── Custom connector references ───────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  Custom Connector References                                     ║"
echo "║  For Telegram, WhatsApp Business, Google Business Profile       ║"
echo "╚══════════════════════════════════════════════════════════════════╝"

echo ""
echo "── python-telegram-bot (Telegram Bot API connector reference) ───"
clone_if_missing \
  "https://github.com/python-telegram-bot/python-telegram-bot" \
  "$TARGET_DIR/python-telegram-bot"

echo ""
echo "── WhatsApp Business SDK (reference for custom connector) ───────"
clone_if_missing \
  "https://github.com/WhatsApp/WhatsApp-Nodejs-SDK" \
  "$TARGET_DIR/whatsapp-nodejs-sdk"

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  Done. Repos cloned to: $TARGET_DIR"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "Platform coverage summary:"
echo "  Postiz (via postiz-mcp):  Facebook, Instagram, LinkedIn, X, Threads,"
echo "                            TikTok, YouTube, Reddit, Pinterest, Bluesky,"
echo "                            Mastodon, Discord, Slack"
echo "  Custom connectors:        Telegram, WhatsApp Business, Google Business"
echo "  Manual-only (AI draft):   Quora"
echo ""
echo "Next steps:"
echo "  1. cd $TARGET_DIR/postiz && cp .env.example .env && docker compose up -d"
echo "  2. cd $TARGET_DIR/postiz-mcp && npm install && configure postiz API key"
echo "  3. Review Nango docs for OAuth token vault setup"
echo "  4. Run mcp-typescript-sdk to scaffold custom connectors"
echo "  5. Keep all repos in downloads/ — excluded from git by .gitignore"
echo ""
echo "IMPORTANT: Quora automation is NOT supported."
echo "  Unofficial Quora APIs are fragile and may violate platform rules."
echo "  Use: AI draft → human review → human posts manually on Quora."
