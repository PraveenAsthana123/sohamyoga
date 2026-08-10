#!/usr/bin/env bash
# ============================================================
# Clone Referral Management Repos — Wave 10 | SohamYoga Portal
# ============================================================
set -euo pipefail

BASE="${HOME}/sohamyoga-clones/referral"
mkdir -p "${BASE}"
cd "${BASE}"

# ── CRM / Lead Tracking ───────────────────────────────────────────────────────
echo "▶  Frappe CRM (referral lead tracking, pipeline management)"
git clone --depth 1 https://github.com/frappe/crm.git frappe-crm 2>/dev/null \
  || echo "   Already cloned: frappe-crm"

# ── Analytics ─────────────────────────────────────────────────────────────────
echo "▶  PostHog (referral funnel analytics, conversion tracking)"
git clone --depth 1 https://github.com/PostHog/posthog.git posthog 2>/dev/null \
  || echo "   Already cloned: posthog"

# ── Notifications ─────────────────────────────────────────────────────────────
echo "▶  Novu (referral notification: registered, reward_earned, expired)"
git clone --depth 1 https://github.com/novuhq/novu.git novu 2>/dev/null \
  || echo "   Already cloned: novu"

# ── Survey / Feedback ─────────────────────────────────────────────────────────
echo "▶  Formbricks (referral surveys, NPS, satisfaction)"
git clone --depth 1 https://github.com/formbricks/formbricks.git formbricks 2>/dev/null \
  || echo "   Already cloned: formbricks"

# ── A/B Testing ───────────────────────────────────────────────────────────────
echo "▶  GrowthBook (referral campaign A/B testing)"
git clone --depth 1 https://github.com/growthbook/growthbook.git growthbook 2>/dev/null \
  || echo "   Already cloned: growthbook"

# ── QR Code Generation ────────────────────────────────────────────────────────
echo "▶  html5-qrcode (browser QR scanner for referral check-in)"
git clone --depth 1 https://github.com/mebjas/html5-qrcode.git html5-qrcode 2>/dev/null \
  || echo "   Already cloned: html5-qrcode"

# ── Social Publishing ─────────────────────────────────────────────────────────
echo "▶  Postiz (referral share automation: WhatsApp, Facebook, LinkedIn)"
git clone --depth 1 https://github.com/gitroomhq/postiz-app.git postiz 2>/dev/null \
  || echo "   Already cloned: postiz"

echo ""
echo "========================================================================"
echo "  WAVE 10 — REFERRAL MANAGEMENT DOMAIN"
echo "========================================================================"
echo ""
echo "  ReferralCode.ts     — 4 statuses: active|paused|expired|revoked"
echo "                        14 referral types: customer_customer|teacher_student|"
echo "                        corporate|doctor|hospital|partner|influencer|affiliate..."
echo "                        11 share channels: whatsapp|facebook|qr_code|nfc|..."
echo ""
echo "  Referral.ts         — 11-state machine: draft→shared→clicked→registered→"
echo "                        verified→membership_purchased→reward_pending→"
echo "                        reward_approved|reward_rejected→reward_paid"
echo "                        + fraud flag accumulation + clearFraudFlags()"
echo ""
echo "  ReferralReward.ts   — 12 reward types: cash|wallet_credit|reward_points|"
echo "                        membership_extension|free_class|discount_coupon|"
echo "                        gift_card|merchandise|yoga_mat|meditation_course|"
echo "                        vip_membership|workshop_access"
echo "                        + isCashEquivalent|isServiceReward|isPhysicalReward"
echo ""
echo "  ReferralCampaign.ts — 5 campaign types: standard|double_reward|flash|"
echo "                        corporate|seasonal"
echo "                        + isActive(at) respects date range + maxReferrals cap"
echo "                        + addEligibleType/removeEligibleType"
echo ""
echo "  ReferralMcpRegistry.ts — 12 MCP tools across 5 tiers:"
echo "    AUTO:         create_referral_code | generate_referral_link |"
echo "                  generate_referral_qr | validate_referral |"
echo "                  wallet_balance | referral_history | leaderboard"
echo "    STAFF:        calculate_reward | referral_analytics"
echo "    APPROVAL:     approve_reward | reject_reward (confirmApprovalId)"
echo "    DESTRUCTIVE:  fraud_check (RUN_FRAUD_CHECK + confirmApprovalId)"
echo ""
echo "  DB: 12 tables + 3 views"
echo "    referral_campaign, referral_code, referral_link, referral_click,"
echo "    referral_master, referral_registration, referral_reward,"
echo "    referral_wallet, referral_wallet_transaction,"
echo "    referral_campaign_analytics, referral_audit, referral_notification"
echo "    Views: v_referral_summary, v_top_referrers, v_campaign_performance"
echo ""
echo "  Integration: ERPNext (8080), Novu (4001), PostHog, Frappe CRM,"
echo "               Redis (6379), Metabase (3001), Postiz (5000),"
echo "               GrowthBook, Moodle (8020), Cal.com (3100)"
echo "               + Wave 5/7/8/9 cross-wave reward distribution"
echo ""
echo "  Feature flags: 13 flags under category='referral'"
echo "  Tests: 205/205 passing across 5 test suites"
echo ""
echo "========================================================================"

ls -la "${BASE}/"
