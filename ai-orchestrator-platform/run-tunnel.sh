#!/usr/bin/env bash
# Cloudflare "quick tunnel" -- zero-config, no Cloudflare account/domain
# needed, but the https://<random>.trycloudflare.com URL changes every time
# this restarts. Points at the frontend (8101), which proxies /api and /ws
# to the backend (8100) -- see frontend/vite.config.ts -- so this one tunnel
# serves the whole app, not just static assets.
set -euo pipefail
exec /home/praveen/.local/bin/cloudflared tunnel --no-autoupdate --url http://127.0.0.1:8101
