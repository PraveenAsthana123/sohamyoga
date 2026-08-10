#!/usr/bin/env bash
# =============================================================================
# clone-visual.sh — Visual Library Source Clones
# For code review, customisation, and offline reference.
# Libraries are already installed via npm install in the project.
# =============================================================================
# npm install equivalents (already run):
#   npm install plyr hls.js aos animejs lottie-web motion swiper
# =============================================================================
set -euo pipefail

CLONE_DIR="${1:-./vendor/visual-libs}"
mkdir -p "$CLONE_DIR"
cd "$CLONE_DIR"

echo "Cloning visual libraries into $(pwd)..."
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

# ── Responsive layout ──────────────────────────────────────────────────────
clone_or_update "bootstrap"     "https://github.com/twbs/bootstrap.git"         "v5.3.3"

# ── Carousel / slider ─────────────────────────────────────────────────────
clone_or_update "swiper"        "https://github.com/nolimits4web/swiper.git"     ""
clone_or_update "splide"        "https://github.com/Splidejs/splide.git"         ""

# ── Video ─────────────────────────────────────────────────────────────────
clone_or_update "plyr"          "https://github.com/sampotts/plyr.git"           ""
clone_or_update "hls.js"        "https://github.com/video-dev/hls.js.git"        ""
clone_or_update "video.js"      "https://github.com/videojs/video.js.git"        ""

# ── Scroll animations ─────────────────────────────────────────────────────
clone_or_update "aos"           "https://github.com/michalsnik/aos.git"          ""
clone_or_update "rellax"        "https://github.com/dixonandmoe/rellax.git"      ""
clone_or_update "gsap-starter"  "https://github.com/greensock/GSAP.git"         ""

# ── JavaScript animation ──────────────────────────────────────────────────
clone_or_update "animejs"       "https://github.com/juliangarnier/anime.git"     ""
clone_or_update "motion"        "https://github.com/motiondivision/motion.git"   ""

# ── Lottie animations ─────────────────────────────────────────────────────
clone_or_update "lottie-web"    "https://github.com/airbnb/lottie-web.git"       ""

# ── 3D ────────────────────────────────────────────────────────────────────
clone_or_update "three.js"      "https://github.com/mrdoob/three.js.git"         ""
clone_or_update "r3f"           "https://github.com/pmndrs/react-three-fiber.git" ""

# ── Summary ───────────────────────────────────────────────────────────────
echo ""
echo "✓  Cloned to: $(pwd)"
echo ""
cat << 'SUMMARY'
╔═══════════════════════════════════════════════════════════════╗
║              Visual Library Reference                         ║
╠═══════════════════════════════════════════════════════════════╣
║  bootstrap    Responsive grid, navbar, cards — MIT            ║
║  swiper       Touch hero/gallery/teacher sliders — MIT        ║
║  splide        Accessible lightweight carousel — MIT          ║
║  plyr          HTML5 / YouTube / Vimeo player — MIT           ║
║  hls.js        HLS .m3u8 adaptive streaming — Apache-2.0      ║
║  video.js      Full-featured HTML5 player — Apache-2.0        ║
║  aos           Scroll-reveal animations — MIT                 ║
║  rellax        Parallax background effects — MIT              ║
║  gsap-starter  Professional timeline animation — OSS-limited  ║
║  animejs       CSS/SVG/DOM animation timeline — MIT           ║
║  motion        React page/card transitions — MIT              ║
║  lottie-web    SVG/canvas Lottie animations — MIT             ║
║  three.js      3D WebGL (pose viewer, virtual studio) — MIT   ║
║  r3f           React Three Fiber wrapper — MIT                ║
╠═══════════════════════════════════════════════════════════════╣
║  npm packages already installed in sohamyoga-frontend/node_modules ║
╚═══════════════════════════════════════════════════════════════╝
SUMMARY
