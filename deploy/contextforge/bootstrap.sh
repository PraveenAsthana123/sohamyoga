#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
target="deploy/contextforge/.env.contextforge.local"
if [[ -e "$target" && "${1:-}" != "--rotate" ]]; then
  echo "ContextForge secret file already exists: $target"
  exit 0
fi
umask 077
jwt_secret="$(openssl rand -hex 48)"
encryption_secret="$(openssl rand -hex 48)"
admin_password="Aa1!$(openssl rand -hex 32)"
printf '%s\n' \
  "JWT_SECRET_KEY=$jwt_secret" \
  "AUTH_ENCRYPTION_SECRET=$encryption_secret" \
  "PLATFORM_ADMIN_EMAIL=admin@sohamyoga.example" \
  "PLATFORM_ADMIN_PASSWORD=$admin_password" \
  "PLATFORM_ADMIN_FULL_NAME=SohamYoga MCP Administrator" > "$target"
chmod 600 "$target"
echo "Created protected ContextForge credentials at $target"
echo "Start: docker compose -f docker-compose.contextforge.yml up -d"
