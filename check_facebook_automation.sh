#!/usr/bin/env bash

set -u

PROJECT_DIR="/mnt/deepa/sohamyoga"
FRONTEND_PORT="8085"
FACEBOOK_CALLBACK="/api/socials/facebook/callback"

echo "============================================================"
echo "      SOHAMYOGA FACEBOOK AUTOMATION HEALTH CHECK"
echo "============================================================"
echo

cd "$PROJECT_DIR" || {
  echo "❌ Cannot enter project directory: $PROJECT_DIR"
  exit 1
}

echo "1. PROJECT"
echo "------------------------------------------------------------"
echo "Directory: $(pwd)"
echo

echo "2. FACEBOOK / POSTIZ CONFIG REFERENCES"
echo "------------------------------------------------------------"

grep -R \
  "FACEBOOK_REDIRECT\|FACEBOOK_CALLBACK\|facebook/callback\|POSTIZ_CLIENT_URL" \
  -n . \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  2>/dev/null | head -n 80

echo
echo "3. ENVIRONMENT VARIABLES"
echo "------------------------------------------------------------"

for name in FACEBOOK_APP_ID FACEBOOK_APP_SECRET POSTIZ_CLIENT_URL; do
  value="$(printenv "$name" 2>/dev/null || true)"

  if [[ -n "$value" ]]; then
    if [[ "$name" == "FACEBOOK_APP_SECRET" ]]; then
      echo "✅ $name is set"
    else
      echo "✅ $name=$value"
    fi
  else
    echo "⚠️  $name is not set"
  fi
done

echo
echo "4. ENV FILES"
echo "------------------------------------------------------------"

find . -maxdepth 5 \
  \( -name ".env" \
     -o -name ".env.local" \
     -o -name ".env.production" \
     -o -name ".env.development" \
     -o -name "*.env" \) \
  -print 2>/dev/null

echo
echo "5. POSTIZ_CLIENT_URL CONFIG"
echo "------------------------------------------------------------"

POSTIZ_LINES="$(
  grep -R "^POSTIZ_CLIENT_URL=" \
    -n . \
    --exclude-dir=node_modules \
    --exclude-dir=.git \
    2>/dev/null || true
)"

if [[ -n "$POSTIZ_LINES" ]]; then
  echo "$POSTIZ_LINES"
else
  echo "⚠️  No active POSTIZ_CLIENT_URL assignment found."
fi

echo
echo "6. RELEVANT LISTENING PORTS"
echo "------------------------------------------------------------"

ss -ltnp 2>/dev/null | grep -E \
  ":3000|:3011|:3200|:3210|:3211|:8085|:15070" \
  || echo "No expected ports found."

echo
echo "7. TEST FACEBOOK CALLBACK"
echo "------------------------------------------------------------"

CALLBACK_URL="http://localhost:${FRONTEND_PORT}${FACEBOOK_CALLBACK}"

curl -sS \
  -o /tmp/facebook_callback_body.txt \
  -w "HTTP_STATUS=%{http_code}\n" \
  "$CALLBACK_URL" 2>/dev/null || true

echo "Response:"
cat /tmp/facebook_callback_body.txt 2>/dev/null || true
echo

echo
echo "8. TEST POSSIBLE POSTIZ PORTS"
echo "------------------------------------------------------------"

for port in 3000 3011 3200 3210 3211; do
  code="$(
    curl -s \
      -o /tmp/postiz_${port}.txt \
      -w "%{http_code}" \
      --max-time 3 \
      "http://localhost:${port}" \
      2>/dev/null || echo "000"
  )"

  printf "Port %-5s HTTP %-4s " "$port" "$code"

  if grep -qi "postiz" /tmp/postiz_${port}.txt 2>/dev/null; then
    echo "✅ POSTIZ candidate"
  else
    title="$(
      grep -oi '<title>[^<]*' /tmp/postiz_${port}.txt 2>/dev/null |
      sed 's/<title>//I' |
      head -n 1
    )"

    if [[ -n "$title" ]]; then
      echo "title='$title'"
    else
      echo
    fi
  fi
done

echo
echo "9. IDENTIFY NODE / NEXT PROCESSES"
echo "------------------------------------------------------------"

for pid in $(pgrep -f "node|next-server" 2>/dev/null); do
  echo
  echo "PID: $pid"
  echo "CMD: $(ps -p "$pid" -o cmd= 2>/dev/null || true)"
  echo "DIR: $(readlink -f /proc/$pid/cwd 2>/dev/null || true)"
done

echo
echo "10. META REDIRECT URI"
echo "------------------------------------------------------------"
echo
echo "$CALLBACK_URL"
echo

echo "============================================================"
echo "                 FINAL DIAGNOSIS"
echo "============================================================"

if grep -qi "POSTIZ_CLIENT_URL" /tmp/facebook_callback_body.txt 2>/dev/null; then
  echo "✅ Facebook callback route exists."
  echo "❌ Postiz connector is not configured/running."
  echo
  echo "Next:"
  echo "1. Identify Postiz port from section 8/9."
  echo "2. Set POSTIZ_CLIENT_URL=http://localhost:<PORT>"
  echo "3. Restart frontend on port 8085."
  echo "4. Run this script again."
else
  echo "Review callback and port results above."
fi

echo
echo "Meta callback to use:"
echo "$CALLBACK_URL"
echo "============================================================"
