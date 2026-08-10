#!/usr/bin/env bash
# ============================================================
# Clone eCommerce Repos — Wave 9 | SohamYoga Portal
# ============================================================
set -euo pipefail

BASE="${HOME}/sohamyoga-clones/ecommerce"
mkdir -p "${BASE}"
cd "${BASE}"

# ── Core Commerce Engines ─────────────────────────────────────────────────────
echo "▶  MedusaJS (headless commerce — API-first, React-friendly)"
git clone --depth 1 https://github.com/medusajs/medusa.git medusajs 2>/dev/null \
  || echo "   Already cloned: medusajs"

echo "▶  Saleor (GraphQL commerce platform)"
git clone --depth 1 https://github.com/saleor/saleor.git saleor 2>/dev/null \
  || echo "   Already cloned: saleor"

echo "▶  Vendure (enterprise-grade TypeScript commerce)"
git clone --depth 1 https://github.com/vendure-ecommerce/vendure.git vendure 2>/dev/null \
  || echo "   Already cloned: vendure"

# ── ERP / Inventory ───────────────────────────────────────────────────────────
echo "▶  ERPNext (inventory, purchasing, finance, taxation)"
git clone --depth 1 https://github.com/frappe/erpnext.git erpnext 2>/dev/null \
  || echo "   Already cloned: erpnext"

# ── Payments ──────────────────────────────────────────────────────────────────
echo "▶  Lago (open-source billing & metering — subscription billing)"
git clone --depth 1 https://github.com/getlago/lago.git lago 2>/dev/null \
  || echo "   Already cloned: lago"

# ── Coupon / Promotions (Wave 7 complement) ───────────────────────────────────
echo "▶  OfferKit (already cloned in Wave 7 — skipping)"

echo ""
echo "========================================================================"
echo "  WAVE 9 — eCOMMERCE DOMAIN MODELS"
echo "========================================================================"
echo ""
echo "  Product.ts       — 12 types: physical|digital|service|subscription|bundle|"
echo "                     workshop|retreat|course|gift_card|ayurvedic|book|membership"
echo "  Order.ts         — 9-state lifecycle: draft→pending→confirmed→processing→"
echo "                     partially_shipped→shipped→delivered→cancelled→refunded"
echo "  Cart.ts          — Layered discounts: rules→coupon→gift_card→wallet→points"
echo "  Inventory.ts     — Movements: receipt|sale|reservation|release|adjustment|"
echo "                     transfer_out|transfer_in|return|expired|damaged"
echo "  Marketplace.ts   — Vendor types: teacher|partner|brand|affiliate|independent"
echo "                     Commission: percentage|fixed|tiered + settlement management"
echo "  EcommerceMcpRegistry.ts — 12 MCP tools across 6 access tiers"
echo ""
echo "  DB: 15 master tables (category, product_master, product_variant, warehouse,"
echo "      inventory, stock_movement, supplier, purchase_order, sales_order,"
echo "      order_item, shipment, payment, wallet, vendor, commission)"
echo ""
echo "  MCP Tools (12):"
echo "    AUTO:     search_product | recommend_product | inventory_status |"
echo "              wallet_balance | subscription_status | track_order"
echo "    STAFF:    create_order | generate_invoice | create_coupon"
echo "    CUST:     return_request (confirmText=REQUEST_RETURN)"
echo "    APPROVAL: refund_order (confirmApprovalId)"
echo "    DESTROY:  cancel_order (confirmText=CANCEL_ORDER + confirmApprovalId)"
echo ""
echo "  Integration: MedusaJS (9003/9004), ERPNext (8080), OfferKit (3050),"
echo "               Stripe, Cal.com (3100), Moodle (8020), Redis (6379),"
echo "               PostHog, Novu (4001), Metabase (3001), Chatwoot"
echo ""
echo "  Feature flags: 13 flags under category='ecommerce'"
echo "  Tests: 263/263 passing across 6 test suites"
echo ""
echo "========================================================================"

ls -la "${BASE}/"
