#!/usr/bin/env bash
# Wave 12 — Carousel / Slider Module
# Clone open-source carousel tools to ~/sohamyoga-clones/carousel/
set -euo pipefail

CLONE_DIR="${HOME}/sohamyoga-clones/carousel"
mkdir -p "$CLONE_DIR"
cd "$CLONE_DIR"

echo "==> Wave 12: Cloning Carousel / Slider tools to $CLONE_DIR"

# --- 1. Swiper — Best overall portal slider (installed via npm: swiper ^14)
# Primary carousel library — already installed via: npm install swiper
echo "[npm] swiper ^14 already installed via npm install swiper"

# --- 2. Embla Carousel — Lightweight dependency-free touch carousel
if [ ! -d "embla-carousel" ]; then
  git clone --depth 1 https://github.com/davidjerleke/embla-carousel.git embla-carousel
  echo "[OK] embla-carousel"
else echo "[SKIP] embla-carousel"; fi

# --- 3. Splide — Accessible, lightweight slider with no dependencies
if [ ! -d "splide" ]; then
  git clone --depth 1 https://github.com/Splidejs/splide.git splide
  echo "[OK] splide"
else echo "[SKIP] splide"; fi

# --- 4. Keen Slider — Touch-friendly, fast slider (Vanilla JS + React plugin)
if [ ! -d "keen-slider" ]; then
  git clone --depth 1 https://github.com/rcbyr/keen-slider.git keen-slider
  echo "[OK] keen-slider"
else echo "[SKIP] keen-slider"; fi

# --- 5. React Multi Carousel — SSR-compatible React/Next.js carousel
if [ ! -d "react-multi-carousel" ]; then
  git clone --depth 1 https://github.com/YIZHUANG/react-multi-carousel.git react-multi-carousel
  echo "[OK] react-multi-carousel"
else echo "[SKIP] react-multi-carousel"; fi

# --- 6. Pure React Carousel — Accessible React carousel (ARIA-compliant)
if [ ! -d "pure-react-carousel" ]; then
  git clone --depth 1 https://github.com/express-labs/pure-react-carousel.git pure-react-carousel
  echo "[OK] pure-react-carousel"
else echo "[SKIP] pure-react-carousel"; fi

# --- 7. React Awesome Slider — Full-screen animated hero slider
if [ ! -d "react-awesome-slider" ]; then
  git clone --depth 1 https://github.com/rcaferati/react-awesome-slider.git react-awesome-slider
  echo "[OK] react-awesome-slider"
else echo "[SKIP] react-awesome-slider"; fi

# --- 8. Glide.js — Small, modular JavaScript slider (no dependencies)
if [ ! -d "glide" ]; then
  git clone --depth 1 https://github.com/glidejs/glide.git glide
  echo "[OK] glide"
else echo "[SKIP] glide"; fi

echo ""
echo "==> Wave 12 clones complete: $CLONE_DIR"
ls -1 "$CLONE_DIR"
