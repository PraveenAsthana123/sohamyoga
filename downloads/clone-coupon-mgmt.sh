#!/usr/bin/env bash
# Wave 7: Coupon & Promotion Management — clone all source repos
# Repos: OfferKit, Medusa, Vendure, Saleor, Casbin (authz)

set -euo pipefail

DEST="${SOHAMYOGA_CLONES:-$HOME/sohamyoga-clones}/coupon-mgmt"
mkdir -p "$DEST"
echo "[coupon] cloning into $DEST"

# --- Headless commerce ---
repos=(
  # OfferKit — lightweight coupon engine + MCP server (inspect for latest tag)
  "https://github.com/sgfn/offerkit.git|offerkit"

  # Medusa — headless commerce: cart, orders, payments, promotion plugin
  "https://github.com/medusajs/medusa.git|medusa"

  # Vendure — alternative TypeScript-native headless commerce
  "https://github.com/vendure-ecommerce/vendure.git|vendure"

  # Saleor — Python/Django headless commerce with promotions API
  "https://github.com/saleor/saleor.git|saleor"

  # Casbin — role/policy-based authorization (for MCP tool access control)
  "https://github.com/casbin/casbin.git|casbin"

  # Coupon codes utility — generates collision-free unique codes
  "https://github.com/voucherifyio/coupon-codes.git|coupon-codes"
)

for entry in "${repos[@]}"; do
  url="${entry%%|*}"
  dir="${entry##*|}"
  target="$DEST/$dir"
  if [[ -d "$target/.git" ]]; then
    echo "  [skip] $dir already cloned"
  else
    echo "  [clone] $dir"
    git clone --depth=1 "$url" "$target" 2>&1 | tail -1
  fi
done

echo ""
echo "=========================================="
echo "  Coupon Management Source Repos"
echo "=========================================="
printf "%-28s %-12s %s\n" "Repo" "Port" "Purpose"
echo "------------------------------------------"
printf "%-28s %-12s %s\n" "offerkit"        "3050"  "Coupon engine + MCP server"
printf "%-28s %-12s %s\n" "medusa"          "9003"  "Headless commerce (cart/orders)"
printf "%-28s %-12s %s\n" "offerkit-redis"  "6379"  "Reservation TTL locks (15 min)"
printf "%-28s %-12s %s\n" "erpnext"         "8080"  "Gift voucher liability ledger"
printf "%-28s %-12s %s\n" "posthog"         "—"     "Coupon A/B analytics"
echo ""
echo "Validation sequence (12 steps):"
echo "  normalize → status → dates → eligibility → product"
echo "  → minSpend → limits → stacking → calculate"
echo "  → reserve(Redis 15min TTL) → payment → commit"
echo ""
echo "Coupon types (19):"
echo "  percentage | fixed_amount | free_class | buy_x_get_y | membership"
echo "  bundle | referral | first_purchase | birthday | student_senior"
echo "  corporate | teacher | event | product | free_shipping"
echo "  gift_voucher | private_unique | public_promo | auto_applied"
echo ""
echo "MCP tools (13 — access-gated):"
echo "  [read]    list_customer_coupons, validate_coupon, preview_discount"
echo "  [confirm] apply_coupon_to_cart, remove_coupon_from_cart"
echo "  [staff]   create_coupon_draft, pause_campaign, get_coupon_analytics"
echo "  [approval] generate_unique_codes, activate_campaign"
echo "  [admin]   revoke_coupon (confirmText=REVOKE), simulate_promotion"
echo "  [audit]   investigate_redemption (auditRoleToken required)"
echo "=========================================="
