#!/usr/bin/env bash
# Wave 13 — User Tracking / Analytics Module
# Clone open-source analytics tools to ~/sohamyoga-clones/analytics/
set -euo pipefail

CLONE_DIR="${HOME}/sohamyoga-clones/analytics"
mkdir -p "$CLONE_DIR"
cd "$CLONE_DIR"

echo "==> Wave 13: Cloning Analytics tools to $CLONE_DIR"

# --- 1. PostHog — Full product analytics (primary choice)
if [ ! -d "posthog" ]; then
  git clone --depth 1 https://github.com/PostHog/posthog.git posthog
  echo "[OK] posthog"
else echo "[SKIP] posthog"; fi

# --- 2. OpenReplay — Session recording and debugging
if [ ! -d "openreplay" ]; then
  git clone --depth 1 https://github.com/openreplay/openreplay.git openreplay
  echo "[OK] openreplay"
else echo "[SKIP] openreplay"; fi

# --- 3. Umami — Lightweight privacy-focused web analytics
if [ ! -d "umami" ]; then
  git clone --depth 1 https://github.com/umami-software/umami.git umami
  echo "[OK] umami"
else echo "[SKIP] umami"; fi

# --- 4. Matomo — Mature Google Analytics alternative (PHP)
if [ ! -d "matomo" ]; then
  git clone --depth 1 https://github.com/matomo-org/matomo.git matomo
  echo "[OK] matomo"
else echo "[SKIP] matomo"; fi

# --- 5. Plausible — Simple privacy-first web analytics
if [ ! -d "plausible-analytics" ]; then
  git clone --depth 1 https://github.com/plausible/analytics.git plausible-analytics
  echo "[OK] plausible-analytics"
else echo "[SKIP] plausible-analytics"; fi

# --- 6. OpenPanel — Modern self-hosted product analytics
if [ ! -d "openpanel" ]; then
  git clone --depth 1 https://github.com/Openpanel-dev/openpanel.git openpanel
  echo "[OK] openpanel"
else echo "[SKIP] openpanel"; fi

# --- 7. GrowthBook — A/B testing and feature flags
if [ ! -d "growthbook" ]; then
  git clone --depth 1 https://github.com/growthbook/growthbook.git growthbook
  echo "[OK] growthbook"
else echo "[SKIP] growthbook"; fi

# --- 8. rrweb — Browser session recording library (underlying tech)
if [ ! -d "rrweb" ]; then
  git clone --depth 1 https://github.com/rrweb-io/rrweb.git rrweb
  echo "[OK] rrweb"
else echo "[SKIP] rrweb"; fi

# --- 9. GoatCounter — Minimal web analytics
if [ ! -d "goatcounter" ]; then
  git clone --depth 1 https://github.com/arp242/goatcounter.git goatcounter
  echo "[OK] goatcounter"
else echo "[SKIP] goatcounter"; fi

echo ""
echo "==> Wave 13 clones complete: $CLONE_DIR"
ls -1 "$CLONE_DIR"
