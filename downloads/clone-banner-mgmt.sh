#!/usr/bin/env bash
# SohamYoga — clone Banner Management & DAM tools
# Penpot, PhotoPrism, Strapi, Ghost, Plyr, Swiper, Excalidraw
# Run: bash clone-banner-mgmt.sh

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

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║    SohamYoga — Banner Management & DAM Clone                ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

echo "─── 1. Penpot (design, banner templates, brand kit) ────────────"
clone_if_missing penpot        https://github.com/penpot/penpot.git
echo ""

echo "─── 2. PhotoPrism (AI media library, asset management) ─────────"
clone_if_missing photoprism    https://github.com/photoprism/photoprism.git
echo ""

echo "─── 3. Strapi (headless CMS: banners, blog, testimonials) ──────"
clone_if_missing strapi        https://github.com/strapi/strapi.git
echo ""

echo "─── 4. Ghost (blog & content publishing) ───────────────────────"
if [ -d "ghost/.git" ]; then
  echo "  [skip] ghost already exists"
else
  clone_if_missing ghost       https://github.com/TryGhost/Ghost.git
fi
echo ""

echo "─── 5. Excalidraw (whiteboard & quick design sketches) ─────────"
clone_if_missing excalidraw    https://github.com/excalidraw/excalidraw.git
echo ""

echo "─── 6. Plyr (video banner player) ──────────────────────────────"
clone_if_missing plyr          https://github.com/sampotts/plyr.git
echo ""

echo "─── 7. Swiper (hero sliders & carousels) ────────────────────────"
clone_if_missing swiper        https://github.com/nolimits4web/swiper.git
echo ""

echo "─── 8. Immich (alternative media library, mobile sync) ─────────"
clone_if_missing immich        https://github.com/immich-app/immich.git
echo ""

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                   Clone complete!                            ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Service ports for Banner Management:"
echo ""
printf "  %-30s %s\n" "Penpot (design studio)"       "9001"
printf "  %-30s %s\n" "PhotoPrism (media library)"   "9002"
printf "  %-30s %s\n" "Strapi (headless CMS)"        "1337"
printf "  %-30s %s\n" "Postiz (social publishing)"   "5000"
printf "  %-30s %s\n" "Portal (Next.js)"             "4000"
echo ""
echo "Start order:"
echo "  docker compose -f ../integrations/strapi/docker-compose.yml up -d"
echo "  docker compose -f ../integrations/photoprism/docker-compose.yml up -d"
echo "  docker compose -f ../integrations/penpot/docker-compose.yml up -d"
echo ""
echo "Social media publishing workflow:"
echo "  Design in Penpot → export assets → upload to PhotoPrism"
echo "  → create Banner in Strapi → schedule via Postiz → publish"
echo ""
echo "Social aspect ratios (auto-generate via portal resize job):"
printf "  %-32s %s\n" "Facebook cover"       "1200 × 630"
printf "  %-32s %s\n" "Instagram square"     "1080 × 1080"
printf "  %-32s %s\n" "Instagram / TikTok story" "1080 × 1920"
printf "  %-32s %s\n" "X banner"             "1600 × 900"
printf "  %-32s %s\n" "LinkedIn article"     "1200 × 627"
printf "  %-32s %s\n" "Pinterest pin"        "1000 × 1500"
printf "  %-32s %s\n" "YouTube thumbnail"    "1280 × 720"
