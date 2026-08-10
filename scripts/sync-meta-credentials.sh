#!/usr/bin/env bash
set -euo pipefail
CFG="${XDG_CONFIG_HOME:-$HOME/.config}/sohamyoga"; ROOT=/mnt/deepa/sohamyoga
source "$CFG/runtime.env"; source "$CFG/ports.env"
command -v jq >/dev/null || { echo 'jq is required' >&2; exit 1; }
# A missing secret is the normal pre-configuration state; keep the minute timer quiet.
payload=$(curl -fs --max-time 8 -H "X-Vault-Token: $OPENBAO_ROOT_TOKEN" "$OPENBAO_ADDR/v1/secret/data/sohamyoga-portal/facebook" 2>/dev/null) || exit 0
app_id=$(jq -er '.data.data.app_id|select(length>0)' <<<"$payload") || exit 0
app_secret=$(jq -er '.data.data.app_secret|select(length>0)' <<<"$payload") || exit 0
social="$CFG/social-integrations.env"; mkdir -p "$CFG"; umask 077; tmp=$(mktemp "$CFG/.social-sync.XXXXXX"); trap 'rm -f "$tmp"' EXIT
if [[ -f "$social" ]]; then awk '!/^(FACEBOOK_APP_ID|FACEBOOK_APP_SECRET|INSTAGRAM_APP_ID|INSTAGRAM_APP_SECRET|THREADS_APP_ID|THREADS_APP_SECRET)=/' "$social" > "$tmp"; fi
quote(){ printf "'%s'" "${1//\'/\'\\\'\'}"; }
{
 printf 'FACEBOOK_APP_ID=%s\n' "$(quote "$app_id")"; printf 'FACEBOOK_APP_SECRET=%s\n' "$(quote "$app_secret")"
 printf 'INSTAGRAM_APP_ID=%s\n' "$(quote "$app_id")"; printf 'INSTAGRAM_APP_SECRET=%s\n' "$(quote "$app_secret")"
} >> "$tmp"
new_hash=$(sha256sum "$tmp"|cut -d' ' -f1); old_hash=$(sha256sum "$social" 2>/dev/null|cut -d' ' -f1||true)
if [[ "$new_hash" != "$old_hash" ]]; then
 mv "$tmp" "$social"; chmod 600 "$social"; trap - EXIT
 set -a; source "$CFG/postiz-runtime.env"; source "$social"; set +a
 docker compose --env-file "$CFG/postiz-runtime.env" --env-file "$social" --env-file "$CFG/ports.env" -f "$ROOT/integrations/postiz/docker-compose.yml" up -d postiz >/dev/null
 echo 'Meta credentials synchronized; Postiz refreshed.'
fi
unset payload app_id app_secret
