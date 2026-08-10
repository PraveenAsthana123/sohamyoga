#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Master Integration Stack Clone Script
# Tier 1 recommended stack for Soham Yoga Portal
#
# Component         Tool          Purpose
# ─────────────────────────────────────────────────────────────────────────────
# OAuth Manager     Nango         Handles OAuth flows, token refresh, 200+ providers
# Social Publishing Postiz        Facebook/Instagram/LinkedIn/X/YouTube/Reddit/etc.
# Workflow          Activepieces  No-code automation (bookings, emails, CRM)
# Workflow (adv.)   n8n           Advanced pipelines with code steps
# Secrets           OpenBao       Vault-compatible secrets — replaces plain .env
# Identity          Keycloak      SSO, OAuth server, RBAC, MFA
# MCP SDKs          MCP TS/PY     Official MCP TypeScript + Python SDKs
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
DEST="${1:-./downloads/vendors/integration}"
mkdir -p "$DEST"
cd "$DEST"

echo "════════════════════════════════════════════════════════════"
echo " Soham Yoga — Integration Stack Clone"
echo "════════════════════════════════════════════════════════════"

# ── 1. Nango — OAuth + API integration manager ────────────────────────────────
echo ""
echo "==> [1/8] Nango — OAuth manager (10/10)"
git clone --depth=1 https://github.com/NangoHQ/nango.git nango
echo "    Replaces: manual OAuth code for every social platform"
echo "    After signup: connect Facebook/LinkedIn/Google once via Nango UI"
echo "    MCP tools call Nango /connection/{id}/token — get fresh token automatically"
echo "    Supports 200+ providers out of the box"

# ── 2. Postiz — Social publishing ────────────────────────────────────────────
echo ""
echo "==> [2/8] Postiz — Social publishing (10/10)"
if [ -d "../../campaign/postiz" ]; then
  echo "    Already cloned in campaign stack — symlinking"
  ln -sf ../../campaign/postiz postiz
else
  git clone --depth=1 https://github.com/gitroomhq/postiz-app.git postiz
fi

# ── 3. Activepieces — No-code automation ────────────────────────────────────
echo ""
echo "==> [3/8] Activepieces — Workflow automation (10/10)"
git clone --depth=1 https://github.com/activepieces/activepieces.git activepieces
echo "    Use for: booking → email → WhatsApp → CRM → Google Calendar → Stripe"
echo "    No-code: drag-and-drop flows for studio staff"
echo "    Replaces: simple Zapier/Make workflows"

# ── 4. n8n — Advanced automation ─────────────────────────────────────────────
echo ""
echo "==> [4/8] n8n — Advanced automation (9.8/10)"
git clone --depth=1 https://github.com/n8n-io/n8n.git n8n
echo "    Use for: complex AI pipelines with code steps"
echo "    Flow: Claude → Generate Banner → Approval → Postiz → Facebook → Slack → CRM"
echo "    Can call Ollama, custom APIs, and all MCP tools"

# ── 5. OpenBao — Secrets management ──────────────────────────────────────────
echo ""
echo "==> [5/8] OpenBao — Secrets management (10/10)"
git clone --depth=1 https://github.com/openbao/openbao.git openbao
echo "    Replaces: plain .env file for secrets"
echo "    All API keys, OAuth tokens, DB passwords stored encrypted in OpenBao"
echo "    Apps read secrets at runtime via /v1/secret/data/slp-portal"
echo "    Audit log: who accessed which secret and when"

# ── 6. Keycloak — Identity & OAuth server ────────────────────────────────────
echo ""
echo "==> [6/8] Keycloak — Identity provider (10/10)"
git clone --depth=1 https://github.com/keycloak/keycloak.git keycloak
echo "    Handles: SSO, Google/Facebook/Apple login, TOTP/SMS MFA, RBAC"
echo "    All portal authentication flows through Keycloak"
echo "    Integrates with Nango for outbound social OAuth"

# ── 7. MCP TypeScript SDK ────────────────────────────────────────────────────
echo ""
echo "==> [7/8] MCP TypeScript SDK (10/10)"
git clone --depth=1 https://github.com/modelcontextprotocol/typescript-sdk.git mcp-typescript-sdk
echo "    Official SDK for building MCP servers in TypeScript"
echo "    Used by all 15 domain MCP servers in this portal"

# ── 8. MCP Python SDK ────────────────────────────────────────────────────────
echo ""
echo "==> [8/8] MCP Python SDK (10/10)"
git clone --depth=1 https://github.com/modelcontextprotocol/python-sdk.git mcp-python-sdk
echo "    For Python-based MCP tools (ML models, data science, analytics)"

echo ""
echo "════════════════════════════════════════════════════════════"
echo " All services cloned. Deploy order:"
echo "════════════════════════════════════════════════════════════"
echo ""
echo " 1. OpenBao    (secrets vault — first, others read from it)"
echo " 2. Keycloak   (identity — portal auth depends on it)"
echo " 3. Nango      (OAuth manager — social publishing needs it)"
echo " 4. Postiz     (social publishing — needs Nango OAuth tokens)"
echo " 5. Activepieces (workflow automation)"
echo " 6. n8n        (advanced pipelines)"
echo ""
echo " Docker Compose files:"
echo "   downloads/docker/openbao/docker-compose.openbao.yml"
echo "   downloads/docker/keycloak/docker-compose.keycloak.yml"
echo "   downloads/docker/nango/docker-compose.nango.yml"
echo "   downloads/docker/postiz/docker-compose.postiz.yml"
echo "   downloads/docker/activepieces/docker-compose.activepieces.yml"
echo "   downloads/docker/n8n/docker-compose.n8n.yml"
echo ""
echo " Or start everything at once:"
echo "   docker compose -f downloads/docker/docker-compose.full-stack.yml up -d"
