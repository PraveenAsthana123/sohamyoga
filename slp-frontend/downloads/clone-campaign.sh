#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Clone script — Digital Marketing Command Centre
#
# Services:
#   Postiz        — Social media scheduling across 16+ platforms
#   Mautic        — Open-source marketing automation (drip, scoring, leads)
#   Listmonk      — Self-hosted email campaigns and newsletters (shared)
#   Strapi        — Headless CMS for blog posts and landing pages
#   Matomo        — Self-hosted web analytics + UTM attribution
#   Penpot        — Open-source design / brand kit creation
#   ComfyUI       — SDXL image generation for banners and social creatives
#   FFmpeg        — Video processing for social video clips
#
# DATA RESIDENCY GUARANTEE:
#   ALL data local: campaign briefs, content variants, brand kit, calendar,
#   UTM links, lead records, analytics — all in local Postgres.
#   External services receive ONLY: rendered text + recipient + OAuth token.
#   No campaign PII (names, health data, profiles) sent to external services.
#   AI content generation via local Ollama only — no cloud AI.
#
# SECURITY CONSTRAINTS:
#   - Never push runtime data to GitHub
#   - Keep API tokens in .env only — never in code or commits
#   - External publishing gated by Postiz approval gateway
#   - CASL / GDPR suppression checked before every outbound send
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
DEST="${1:-./downloads/vendors/campaign}"
mkdir -p "$DEST"
cd "$DEST"

echo "==> [1/8] Cloning Postiz — social scheduling (16+ platforms)"
git clone --depth=1 https://github.com/gitroomhq/postiz-app.git postiz
echo "    Postiz: Schedule posts to Facebook, Instagram, LinkedIn, X, TikTok, YouTube, Pinterest, Reddit, Bluesky, Mastodon, Telegram, Discord, WhatsApp Business and more."
echo "    Config: POSTIZ_CLIENT_URL + OAuth tokens per platform in .env"
echo "    Approval: All social publish actions go through Postiz queue — no direct API writes"

echo ""
echo "==> [2/8] Cloning Mautic — marketing automation"
git clone --depth=1 https://github.com/mautic/mautic.git mautic
echo "    Mautic: Lead scoring, drip sequences, campaign workflows, email/SMS automation"
echo "    Integrates with Frappe CRM for lead pipeline sync"
echo "    Config: MAUTIC_DB_* + MAUTIC_MAILER_* in .env"

echo ""
echo "==> [3/8] Cloning Listmonk — email campaigns (shared with Notification Center)"
if [ -d "../../notification/listmonk" ]; then
  echo "    Listmonk already cloned in notification stack — skipping (shared)"
else
  git clone --depth=1 https://github.com/knadh/listmonk.git listmonk
  echo "    Config: LISTMONK_db__host + LISTMONK_db__password in .env"
fi

echo ""
echo "==> [4/8] Cloning Strapi — headless CMS for blog and landing pages"
git clone --depth=1 https://github.com/strapi/strapi.git strapi
echo "    Strapi: Blog posts, landing pages, product pages, SEO metadata"
echo "    Content stored in Strapi Postgres, mirrored to portal via API"
echo "    Config: DATABASE_CLIENT=postgres + DATABASE_URL in .env"

echo ""
echo "==> [5/8] Cloning Matomo — UTM attribution analytics"
git clone --depth=1 https://github.com/matomo-org/matomo.git matomo
echo "    Matomo: Self-hosted analytics — UTM campaign tracking, funnels, goals"
echo "    GDPR-compliant: data stays local, no sampling, no third-party sharing"
echo "    Config: MATOMO_DATABASE_* in .env"

echo ""
echo "==> [6/8] Cloning Penpot — brand kit design"
git clone --depth=1 https://github.com/penpot/penpot.git penpot
echo "    Penpot: Open-source Figma alternative for creating brand assets"
echo "    Use for: logo variants, banner templates, social post templates"

echo ""
echo "==> [7/8] Cloning ComfyUI — AI image generation for ad creatives"
git clone --depth=1 https://github.com/comfyanonymous/ComfyUI.git comfyui
echo "    ComfyUI: Stable Diffusion XL workflows for banner and social image generation"
echo "    All generation runs locally on GPU — no images sent to cloud AI"
echo "    WARNING: Generated images require brand compliance review before publishing"

echo ""
echo "==> [8/8] Checking FFmpeg (system package preferred)"
if ! command -v ffmpeg &>/dev/null; then
  echo "    FFmpeg not found — install via: sudo apt install ffmpeg"
  echo "    Used for: video transcoding, thumbnail extraction, social clip optimization"
else
  echo "    FFmpeg found: $(ffmpeg -version 2>&1 | head -1)"
fi

echo ""
echo "════════════════════════════════════════════════════════════════════"
echo " Campaign Command Centre — all services cloned"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo " Recommended deploy sequence:"
echo "   1. docker compose up matomo       # UTM tracking first"
echo "   2. docker compose up mautic       # Lead automation"
echo "   3. docker compose up strapi       # CMS / blog"
echo "   4. docker compose up postiz       # Social scheduling"
echo "   5. docker compose up penpot       # Design tool"
echo "   6. docker compose up comfyui      # Image generation (GPU)"
echo ""
echo " Data residency architecture:"
echo "   Portal DB (Postgres):"
echo "     campaign_brief, content_variant, brand_kit, content_calendar_entry,"
echo "     utm_link, campaign_lead, campaign_analytics"
echo "   What leaves the server:"
echo "     → Postiz: rendered post text + platform OAuth token"
echo "     → Listmonk: rendered email body + recipient address"
echo "     → Mautic: campaign trigger signals (no PII in payloads)"
echo "     → Matomo: page view events (self-hosted, stays local)"
echo "   What NEVER leaves:"
echo "     Student health data, profiles, membership details,"
echo "     brand kit banned phrases, AI generation prompts"
echo ""
echo " AI safety:"
echo "   generate_campaign_copy and adapt_content_for_platform use"
echo "   local Ollama only. Health/wellness claims must be reviewed"
echo "   by qualified staff before any content is published."
echo ""
echo " Config required in .env (never commit these):"
echo "   POSTIZ_API_KEY, POSTIZ_CLIENT_URL"
echo "   MAUTIC_USER, MAUTIC_PASSWORD, MAUTIC_BASE_URL"
echo "   STRAPI_API_TOKEN"
echo "   MATOMO_SITE_ID, MATOMO_BASE_URL"
