#!/usr/bin/env bash
# =============================================================================
# clone-auth.sh — Authentication, QR Check-In, and Registration Libraries
# =============================================================================
# These are reference/integration libraries. The runtime dependency is
# Keycloak running in Docker; see downloads/docker/keycloak/docker-compose.yml
# =============================================================================
set -euo pipefail

CLONE_DIR="${1:-./vendor/auth-libs}"
mkdir -p "$CLONE_DIR"
cd "$CLONE_DIR"

echo "Cloning auth + QR libraries into $(pwd)…"
echo ""

clone_or_update() {
  local name="$1"
  local url="$2"
  local tag="${3:-}"
  if [ -d "$name/.git" ]; then
    echo "  [↻] $name — updating"
    git -C "$name" pull --quiet --ff-only 2>/dev/null || true
  else
    echo "  [↓] $name"
    git clone --depth=1 ${tag:+--branch "$tag"} "$url" "$name" --quiet
  fi
}

# ── Identity / SSO ────────────────────────────────────────────────────────
echo "── Identity Providers ──"
clone_or_update "keycloak"              "https://github.com/keycloak/keycloak.git"               ""
clone_or_update "keycloak-quickstarts"  "https://github.com/keycloak/keycloak-quickstarts.git"   ""
clone_or_update "authentik"             "https://github.com/goauthentik/authentik.git"            ""
clone_or_update "logto"                 "https://github.com/logto-io/logto.git"                   ""

# ── QR / Barcode scanning ─────────────────────────────────────────────────
echo ""
echo "── QR / Barcode Scanners ──"
clone_or_update "html5-qrcode"          "https://github.com/mebjas/html5-qrcode.git"              ""
clone_or_update "quagga2"               "https://github.com/ericblade/quagga2.git"                ""
clone_or_update "zxing-js"              "https://github.com/zxing-js/library.git"                 ""
clone_or_update "qr-code-styling"       "https://github.com/kozakdenys/qr-code-styling.git"       ""

# ── Registration / event ticketing reference ──────────────────────────────
echo ""
echo "── Registration & Ticketing ──"
clone_or_update "hi-events"             "https://github.com/HiEventsDev/hi.events.git"            ""

# ── Social lead forms / CRM ───────────────────────────────────────────────
echo ""
echo "── Social Lead & CRM ──"
clone_or_update "frappe-crm"            "https://github.com/frappe/crm.git"                       ""
clone_or_update "formbricks"            "https://github.com/formbricks/formbricks.git"             ""
clone_or_update "activepieces"          "https://github.com/activepieces/activepieces.git"         ""

# ── MCP SDK ───────────────────────────────────────────────────────────────
echo ""
echo "── MCP SDK ──"
clone_or_update "mcp-typescript-sdk"    "https://github.com/modelcontextprotocol/typescript-sdk.git" ""

# ── Summary ───────────────────────────────────────────────────────────────
echo ""
echo "✓  Cloned to: $(pwd)"
echo ""
cat << 'SUMMARY'
╔═══════════════════════════════════════════════════════════════════════════╗
║  Auth + QR + Registration Library Reference                               ║
╠══════════════════════════════╦════════════════════════════════════════════╣
║  Library                     ║  Purpose / Notes                           ║
╠══════════════════════════════╬════════════════════════════════════════════╣
║  keycloak                    ║  Identity broker: OIDC, OAuth2, SAML, MFA  ║
║  keycloak-quickstarts        ║  Working Java/JS integration examples       ║
║  authentik                   ║  Alternative SSO (OIDC, SAML, LDAP)         ║
║  logto                       ║  Modern B2C login, social, passwordless      ║
╠══════════════════════════════╬════════════════════════════════════════════╣
║  html5-qrcode                ║  ★ PRIMARY — browser camera QR/barcode scan ║
║  quagga2                     ║  1D barcode real-time (Code128, EAN, UPC)   ║
║  zxing-js                    ║  Multi-format scan: QR, DataMatrix, Aztec   ║
║  qr-code-styling             ║  Branded QR generation with logo + color    ║
╠══════════════════════════════╬════════════════════════════════════════════╣
║  hi-events                   ║  Reference: tickets, QR scan, checkin lists ║
║  frappe-crm                  ║  CRM for social lead storage                ║
║  formbricks                  ║  Open onboarding / registration forms       ║
║  activepieces                ║  Workflow automation (lead→customer)         ║
╠══════════════════════════════╬════════════════════════════════════════════╣
║  mcp-typescript-sdk          ║  Build identity/checkin MCP adapters        ║
╠══════════════════════════════╬════════════════════════════════════════════╣
║  npm install (already run):                                                ║
║    html5-qrcode                                                            ║
╠══════════════════════════════════════════════════════════════════════════╣
║  SECURITY:  Replace all changeme_* placeholders in Docker env files        ║
║  NEVER commit .env files or Keycloak admin credentials to git              ║
╚═══════════════════════════════════════════════════════════════════════════╝
SUMMARY
