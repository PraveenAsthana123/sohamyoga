#!/usr/bin/env bash
set -u
CFG="${XDG_CONFIG_HOME:-$HOME/.config}/sohamyoga"
source "$CFG/ports.env"
source "$CFG/runtime.env" 2>/dev/null || true
SOCIAL="$CFG/social-integrations.env"
facebook=missing
if [[ -f "$SOCIAL" ]]; then
 source "$SOCIAL"
 if [[ -n "${FACEBOOK_APP_ID:-}" && -n "${FACEBOOK_APP_SECRET:-}" ]]; then facebook=configured
 elif [[ -n "${FACEBOOK_APP_ID:-}" || -n "${FACEBOOK_APP_SECRET:-}" ]]; then facebook=partial
 fi
fi
probe(){
 local url="$1" code
 code=$(curl -sS -o /dev/null --max-time 5 -w '%{http_code}' "$url" 2>/dev/null || true)
 printf '%s' "${code:-000}"
}
openbao=$(probe "http://127.0.0.1:${SOHAM_OPENBAO_PORT:-18200}/v1/sys/health")
postiz=$(probe "http://127.0.0.1:${SOHAM_POSTIZ_PORT:-15080}/")
portal=$(probe "http://127.0.0.1:${SOHAM_FRONTEND_PORT}/admin/social/meta-setup")
callback=$(probe "http://127.0.0.1:${SOHAM_FRONTEND_PORT}/api/socials/facebook/callback")
printf 'facebook_credentials=%s\nopenbao_http=%s\npostiz_http=%s\nportal_http=%s\ncallback_http=%s\n' "$facebook" "$openbao" "$postiz" "$portal" "$callback"
[[ "$openbao" =~ ^2 && "$postiz" =~ ^(2|3) && "$portal" =~ ^(2|3) && "$callback" =~ ^(2|3) ]]
