#!/usr/bin/env bash
# SohamYoga — clone social MCP stack
# Components: Postiz + Postiz MCP + MCP SDKs + Nango + Activepieces
# Run: bash clone-social.sh

set -euo pipefail
BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BASE"

clone_if_missing() {
  local dir="$1"; local url="$2"
  if [ -d "$dir/.git" ]; then
    echo "  [skip] $dir already exists"
  else
    echo "  [clone] $url → $dir"
    git clone --depth 1 "$url" "$dir"
  fi
}

echo "=== SohamYoga Social MCP Stack ==="
echo ""

echo "--- 1. Postiz (social media portal) ---"
clone_if_missing postiz              https://github.com/gitroomhq/postiz-app.git
echo ""

echo "--- 2. Postiz MCP (AI/MCP adapter for Postiz) ---"
clone_if_missing postiz-mcp          https://github.com/antoniolg/postiz-mcp.git
echo ""

echo "--- 3. MCP TypeScript SDK ---"
clone_if_missing mcp-typescript-sdk  https://github.com/modelcontextprotocol/typescript-sdk.git
echo ""

echo "--- 4. MCP Python SDK ---"
clone_if_missing mcp-python-sdk      https://github.com/modelcontextprotocol/python-sdk.git
echo ""

echo "--- 5. MCP Reference Servers (examples) ---"
clone_if_missing mcp-servers         https://github.com/modelcontextprotocol/servers.git
echo ""

echo "--- 6. Nango (OAuth token management) ---"
clone_if_missing nango               https://github.com/NangoHQ/nango.git
echo ""

echo "--- 7. Activepieces (approval workflows + automation) ---"
clone_if_missing activepieces        https://github.com/activepieces/activepieces.git
echo ""

echo "=== Done. All repos in: $BASE ==="
echo ""
echo "Quick start:"
echo "  1. Start Postiz:       cd ../integrations/postiz && docker compose up -d"
echo "  2. Configure OAuth:    edit integrations/postiz/.env"
echo "  3. Start Postiz MCP:   cd postiz-mcp && npm install && npm start"
echo "  4. MCP endpoint:       POSTIZ_URL=http://localhost:3000 npx postiz-mcp"
echo "  5. Yoga portal MCP:    http://localhost:4000/api/mcp/social (see /src/app/api/mcp/social/route.ts)"
