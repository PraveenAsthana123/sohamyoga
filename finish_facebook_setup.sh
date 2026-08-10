#!/usr/bin/env bash
set -u

ROOT="/mnt/deepa/sohamyoga"
FRONTEND="$ROOT/slp-frontend"
ENVFILE="$FRONTEND/.env.local"

BACKEND="http://127.0.0.1:15070"
FRONTEND_URL="http://127.0.0.1:8085"
POSTIZ="http://127.0.0.1:15080"

FACEBOOK_APP_ID="998353279926364"

echo "============================================================"
echo "       SOHAMYOGA FACEBOOK FINAL CONFIGURATION"
echo "============================================================"
echo

cd "$FRONTEND" || exit 1
touch "$ENVFILE"

set_env () {
    KEY="$1"
    VALUE="$2"

    if grep -q "^${KEY}=" "$ENVFILE" 2>/dev/null; then
        sed -i "s|^${KEY}=.*|${KEY}=${VALUE}|" "$ENVFILE"
    else
        printf '%s=%s\n' "$KEY" "$VALUE" >> "$ENVFILE"
    fi
}

echo "1. CONFIGURE BACKEND"
echo "------------------------------------------------------------"

set_env "NEXT_PUBLIC_API_URL" "$BACKEND"
set_env "INTERNAL_API_URL" "$BACKEND"

echo "✅ NEXT_PUBLIC_API_URL=$BACKEND"
echo "✅ INTERNAL_API_URL=$BACKEND"

echo
echo "2. CONFIGURE POSTIZ"
echo "------------------------------------------------------------"

set_env "POSTIZ_CLIENT_URL" "$POSTIZ"

echo "✅ POSTIZ_CLIENT_URL=$POSTIZ"

echo
echo "3. CONFIGURE FACEBOOK APP ID"
echo "------------------------------------------------------------"

set_env "FACEBOOK_APP_ID" "$FACEBOOK_APP_ID"

echo "✅ FACEBOOK_APP_ID=$FACEBOOK_APP_ID"

echo
echo "4. FACEBOOK APP SECRET"
echo "------------------------------------------------------------"

if grep -q '^FACEBOOK_APP_SECRET=.' "$ENVFILE" 2>/dev/null; then

    echo "✅ FACEBOOK_APP_SECRET already exists."

else

    echo "Open Meta for Developers:"
    echo "App Settings -> Basic -> App Secret -> Show"
    echo
    echo "Paste the App Secret below."
    echo "It WILL NOT be displayed."
    echo

    read -rsp "Facebook App Secret: " FB_SECRET
    echo

    if [ -n "$FB_SECRET" ]; then
        set_env "FACEBOOK_APP_SECRET" "$FB_SECRET"
        unset FB_SECRET
        echo "✅ FACEBOOK_APP_SECRET saved locally."
    else
        echo "⚠️ App Secret skipped."
    fi
fi

chmod 600 "$ENVFILE"

echo
echo "5. TEST .NET BACKEND :15070"
echo "------------------------------------------------------------"

for path in /api/health /health /; do

    CODE=$(
        curl -s \
        -o /tmp/soham_backend.txt \
        -w "%{http_code}" \
        --max-time 5 \
        "$BACKEND$path" 2>/dev/null || echo "000"
    )

    echo "$BACKEND$path -> HTTP $CODE"

    if [ "$CODE" != "000" ]; then
        head -c 250 /tmp/soham_backend.txt 2>/dev/null
        echo
    fi
done

echo
echo "6. TEST POSTIZ"
echo "------------------------------------------------------------"

POSTIZ_CODE=$(
    curl -s \
    -o /dev/null \
    -w "%{http_code}" \
    --max-time 5 \
    "$POSTIZ" 2>/dev/null || echo "000"
)

echo "$POSTIZ -> HTTP $POSTIZ_CODE"

docker ps --filter name=sohamyoga_postiz \
    --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

echo
echo "7. STOP OLD :8085 FRONTEND"
echo "------------------------------------------------------------"

pkill -f "next dev.*8085" 2>/dev/null || true
sleep 2

echo "✅ Old frontend stopped."

echo
echo "8. START FRONTEND :8085"
echo "------------------------------------------------------------"

cd "$FRONTEND" || exit 1

nohup pnpm dev --hostname 127.0.0.1 --port 8085 \
    >/tmp/sohamyoga-8085.log 2>&1 &

FRONT_PID=$!

echo "Frontend PID: $FRONT_PID"

for i in {1..20}; do

    CODE=$(
        curl -s \
        -o /dev/null \
        -w "%{http_code}" \
        --max-time 3 \
        "$FRONTEND_URL" 2>/dev/null || echo "000"
    )

    if [ "$CODE" != "000" ]; then
        echo "✅ Frontend ready: HTTP $CODE"
        break
    fi

    echo "Waiting for frontend... $i/20"
    sleep 2
done

echo
echo "9. META HEALTH"
echo "------------------------------------------------------------"

curl -sS -i \
    "$FRONTEND_URL/api/social/meta-health" \
    --max-time 10 || true

echo
echo
echo "10. SOCIAL SETUP"
echo "------------------------------------------------------------"

curl -sS -i \
    "$FRONTEND_URL/api/social/setup" \
    --max-time 10 || true

echo
echo
echo "11. FACEBOOK CALLBACK"
echo "------------------------------------------------------------"

curl -sS -i \
    "$FRONTEND_URL/api/socials/facebook/callback" \
    --max-time 10 || true

echo
echo
echo "12. FINAL ENVIRONMENT"
echo "------------------------------------------------------------"

grep '^NEXT_PUBLIC_API_URL=' "$ENVFILE"
grep '^INTERNAL_API_URL=' "$ENVFILE"
grep '^POSTIZ_CLIENT_URL=' "$ENVFILE"
grep '^FACEBOOK_APP_ID=' "$ENVFILE"

if grep -q '^FACEBOOK_APP_SECRET=.' "$ENVFILE"; then
    echo "FACEBOOK_APP_SECRET=✅ CONFIGURED"
else
    echo "FACEBOOK_APP_SECRET=❌ MISSING"
fi

echo
echo "13. FRONTEND LOG"
echo "------------------------------------------------------------"

tail -n 30 /tmp/sohamyoga-8085.log

echo
echo "============================================================"
echo "                 EXPECTED ARCHITECTURE"
echo "============================================================"
echo
echo "Meta"
echo "  |"
echo "  v"
echo "SohamYoga Next.js :8085"
echo "  |"
echo "  +----> .NET API :15070"
echo "  |"
echo "  +----> Postiz :15080"
echo "             |"
echo "             v"
echo "        Facebook Page"
echo
echo "Meta OAuth Callback:"
echo "$FRONTEND_URL/api/socials/facebook/callback"
echo
echo "============================================================"
