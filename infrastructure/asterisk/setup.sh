#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  umask 077
  sip_secret="$(openssl rand -hex 24)"
  ari_secret="$(openssl rand -hex 24)"
  printf 'ASTERISK_SIP_SECRET=%s\nASTERISK_ARI_SECRET=%s\n' "$sip_secret" "$ari_secret" > .env
fi
chmod 0600 .env
docker compose config --quiet
docker compose up -d --build
docker compose ps

