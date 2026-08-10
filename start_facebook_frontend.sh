#!/usr/bin/env bash
set -u

FRONTEND="/mnt/deepa/sohamyoga/slp-frontend"
LOG="/tmp/sohamyoga-8085.log"
PIDFILE="/tmp/sohamyoga-8085.pid"

echo "============================================================"
echo "      SOHAMYOGA FACEBOOK FRONTEND START + TEST"
echo "============================================================"

echo
echo "1. CHECK REQUIRED CONFIG"
echo "------------------------------------------------------------"

cd "$FRONTEND" || exit 1

for KEY in \
    NEXT_PUBLIC_API_URL \
    INTERNAL_API_URL \
    POSTIZ_CLIENT_URL \
    FACEBOOK_APP_ID \
    FACEBOOK_APP_SECRET
do
    if grep -q "^${KEY}=." .env.local 2>/dev/null; then
        if [ "$KEY" = "FACEBOOK_APP_SECRET" ]; then
            echo "✅ $KEY configured"
        else
            grep "^${KEY}=" .env.local
        fi
    else
        echo "❌ $KEY missing"
    fi
done

echo
echo "2. CHECK DEPENDENCIES"
echo "------------------------------------------------------------"

BACKEND_CODE="$(curl -s -o /dev/null -w '%{http_code}' \
    --max-time 5 http://127.0.0.1:15070/api/health 2>/dev/null || true)"

POSTIZ_CODE="$(curl -s -o /dev/null -w '%{http_code}' \
    --max-time 5 http://127.0.0.1:15080 2>/dev/null || true)"

echo ".NET backend :15070 -> HTTP ${BACKEND_CODE:-DOWN}"
echo "Postiz       :15080 -> HTTP ${POSTIZ_CODE:-DOWN}"

echo
echo "3. STOP ONLY THE PROCESS USING PORT 8085"
echo "------------------------------------------------------------"

OLDPID="$(lsof -tiTCP:8085 -sTCP:LISTEN 2>/dev/null | head -1 || true)"

if [ -n "$OLDPID" ]; then
    echo "Stopping existing PID $OLDPID on port 8085"
    kill "$OLDPID" 2>/dev/null || true
    sleep 2
fi

if ss -ltn 2>/dev/null | grep -q ':8085 '; then
    echo "⚠️ Port 8085 is still occupied."
    ss -ltnp | grep ':8085' || true
else
    echo "✅ Port 8085 available"
fi

echo
echo "4. START NEXT.JS IN INDEPENDENT SESSION"
echo "------------------------------------------------------------"

rm -f "$LOG" "$PIDFILE"

setsid bash -lc "
    cd '$FRONTEND'
    exec pnpm dev --hostname 127.0.0.1 --port 8085
" >"$LOG" 2>&1 < /dev/null &

STARTPID=$!
echo "$STARTPID" > "$PIDFILE"

echo "Launcher PID: $STARTPID"

echo
echo "5. WAIT FOR PORT 8085"
echo "------------------------------------------------------------"

READY=0

for i in $(seq 1 30); do
    if ss -ltn 2>/dev/null | grep -q ':8085 '; then
        echo "✅ Port 8085 is listening"
        READY=1
        break
    fi

    if ! kill -0 "$STARTPID" 2>/dev/null; then
        echo "❌ Frontend process exited before becoming ready."
        break
    fi

    echo "Waiting... $i/30"
    sleep 1
done

echo
echo "6. PROCESS STATUS"
echo "------------------------------------------------------------"

ss -ltnp 2>/dev/null | grep ':8085' || true

echo
echo "Matching processes:"
ps -ef | grep -E 'next.*8085|pnpm.*8085' | grep -v grep || true

echo
echo "7. FRONTEND LOG"
echo "------------------------------------------------------------"

cat "$LOG" 2>/dev/null || true

if [ "$READY" -ne 1 ]; then
    echo
    echo "============================================================"
    echo "❌ FRONTEND DID NOT START"
    echo "============================================================"
    exit 1
fi

echo
echo "8. TEST HOME PAGE"
echo "------------------------------------------------------------"

curl -sS \
    -o /tmp/soham-home.txt \
    -w 'HTTP %{http_code}\n' \
    --max-time 10 \
    http://127.0.0.1:8085/ || true

echo
echo "9. TEST META HEALTH"
echo "------------------------------------------------------------"

curl -sS -i \
    --max-time 10 \
    http://127.0.0.1:8085/api/social/meta-health || true

echo
echo
echo "10. TEST SOCIAL SETUP"
echo "------------------------------------------------------------"

curl -sS -i \
    --max-time 10 \
    http://127.0.0.1:8085/api/social/setup || true

echo
echo
echo "11. TEST FACEBOOK CALLBACK"
echo "------------------------------------------------------------"

curl -sS -i \
    --max-time 10 \
    http://127.0.0.1:8085/api/socials/facebook/callback || true

echo
echo
echo "============================================================"
echo "                  CURRENT ARCHITECTURE"
echo "============================================================"
echo
echo "SohamYoga Next.js :8085"
echo "        |"
echo "        +------> .NET Backend :15070"
echo "        |"
echo "        +------> Postiz :15080"
echo "                       |"
echo "                       +------> Meta / Facebook"
echo
echo "Meta OAuth redirect URI:"
echo "http://localhost:8085/api/socials/facebook/callback"
echo
echo "Log:"
echo "$LOG"
echo "============================================================"
