#!/bin/bash
# BotForge API smoke test — run against a fresh server instance
set -e
B="http://localhost:10000/api"
J=/tmp/bf_token
PASS=0; FAIL=0
chk() { # name, expected_substring, actual
  if echo "$3" | grep -q "$2"; then PASS=$((PASS+1)); echo "✓ $1";
  else FAIL=$((FAIL+1)); echo "✗ $1  →  $(echo "$3" | head -c 200)"; fi
}

echo "── public endpoints ──"
chk "health" '"ok":true' "$(curl -s $B/health)"
chk "templates has knightbot" 'knightbot-mini' "$(curl -s $B/templates)"
chk "templates count 6" 'python-247' "$(curl -s $B/templates)"
chk "public stats" 'services' "$(curl -s $B/stats)"
chk "system" 'pinger' "$(curl -s $B/system)"

echo "── auth ──"
chk "register admin" '"role":"admin"' "$(curl -s -X POST $B/auth/register -H 'Content-Type: application/json' -d '{"email":"admin@botforge.dev","password":"forge123","name":"Forge Admin"}')"
T=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@botforge.dev","password":"forge123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
[ -n "$T" ] && { PASS=$((PASS+1)); echo "✓ login token"; } || echo "✗ login token"
chk "me requires auth" 'Authentication required' "$(curl -s $B/me)"
chk "me works" '"hasRenderKey":false' "$(curl -s $B/me -H "Authorization: Bearer $T")"
chk "me mode demo" '"mode":"demo"' "$(curl -s $B/me -H "Authorization: Bearer $T")"
chk "dup register blocked" 'already exists' "$(curl -s -X POST $B/auth/register -H 'Content-Type: application/json' -d '{"email":"admin@botforge.dev","password":"forge123"}')"

echo "── render demo connect ──"
chk "workspaces (demo)" 'Demo Workspace' "$(curl -s $B/render/workspaces -H "Authorization: Bearer $T")"
chk "connect rejects demo key" 'demo key' "$(curl -s -X POST $B/render/connect -H 'Content-Type: application/json' -H "Authorization: Bearer $T" -d '{"apiKey":"rnd_DEMOKEY"}')"

echo "── deploy knightbot (demo) ──"
SVC=$(curl -s -X POST $B/services -H 'Content-Type: application/json' -H "Authorization: Bearer $T" -d '{"templateId":"knightbot-mini","name":"test-knightbot","env":[{"key":"SESSION_ID","value":""}],"keepAlive":true}')
chk "deploy created" '"status":"deploying"' "$SVC"
chk "deploy url" 'test-knightbot.onrender.com' "$SVC"
SID=$(echo "$SVC" | python3 -c 'import sys,json;print(json.load(sys.stdin)["service"]["id"])')
echo "  service id: $SID"

echo "── required env check ──"
chk "missing required env blocked" 'Missing required environment variable' "$(curl -s -X POST $B/services -H 'Content-Type: application/json' -H "Authorization: Bearer $T" -d '{"templateId":"discordjs-bot","name":"bad-discord"}')"

echo "── service detail / actions ──"
chk "service detail" '"name":"test-knightbot"' "$(curl -s $B/services/$SID -H "Authorization: Bearer $T")"
sleep 3
chk "logs show QR mention" 'qr' "$(curl -s $B/services/$SID/logs -H "Authorization: Bearer $T" | head -c 3000)"
L=$(curl -s $B/services/$SID/logs -H "Authorization: Bearer $T")
chk "logs artifact qr" '"qr":true' "$L"
chk "suspend" '"status":"suspended"' "$(curl -s -X POST $B/services/$SID/action -H 'Content-Type: application/json' -H "Authorization: Bearer $T" -d '{"action":"suspend"}')"
chk "suspend stops logs" 'not running' "$(curl -s $B/services/$SID/logs -H "Authorization: Bearer $T")"
chk "resume" '"status":"live"' "$(curl -s -X POST $B/services/$SID/action -H 'Content-Type: application/json' -H "Authorization: Bearer $T" -d '{"action":"resume"}')"
sleep 3
chk "logs back after resume" 'Scan this QR' "$(curl -s $B/services/$SID/logs -H "Authorization: Bearer $T")"

echo "── env vars ──"
# (env masking with empty value → skipped)
E=$(curl -s -X PUT $B/services/$SID/env -H 'Content-Type: application/json' -H "Authorization: Bearer $T" -d '{"SESSION_ID":"KnightBot!SGVsbG8=","NEW_VAR":"hello"}')
chk "env update ok" '"changed":2' "$E"
chk "env masked now" '"SESSION_ID":"Knig********' "$(curl -s $B/services/$SID/env -H "Authorization: Bearer $T")"

echo "── deploys / uptime ──"
chk "deploys list" 'dep-initial' "$(curl -s $B/services/$SID/deploys -H "Authorization: Bearer $T")"
chk "uptime" 'keepAlive' "$(curl -s $B/uptime -H "Authorization: Bearer $T")"

echo "── qr.png ──"
Q=$(curl -s -o /tmp/qr.png -w "%{http_code}" $B/services/$SID/qr.png -H "Authorization: Bearer $T")
if [ "$Q" = "200" ]; then PASS=$((PASS+1)); echo "✓ qr.png 200"; else FAIL=$((FAIL+1)); echo "✗ qr.png → $Q"; fi
file /tmp/qr.png | grep -q PNG && { PASS=$((PASS+1)); echo "✓ qr.png is PNG"; } || { FAIL=$((FAIL+1)); echo "✗ qr.png not PNG: $(file /tmp/qr.png)"; }

echo "── auth edge cases ──"
chk "second user is user role" '"role":"user"' "$(curl -s -X POST $B/auth/register -H 'Content-Type: application/json' -d '{"email":"user2@botforge.dev","password":"forge123","name":"Second User"}')"
T2=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"email":"user2@botforge.dev","password":"forge123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
chk "user2 cannot read svc1" 'Not your service' "$(curl -s $B/services/$SID -H "Authorization: Bearer $T2")"
chk "user2 cannot access admin" 'Admin access required' "$(curl -s $B/admin/stats -H "Authorization: Bearer $T2")"

echo "── admin ──"
chk "admin stats" '"services":1' "$(curl -s $B/admin/stats -H "Authorization: Bearer $T")"
NOLEAK=$(curl -s $B/admin/users -H "Authorization: Bearer $T" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("LEAK" if any("passwordHash" in u or "renderApiKeyEnc" in u for u in d) else "CLEAN")')
chk "admin users no hash leak" 'CLEAN' "$NOLEAK"

echo "── delete ──"
SVC2=$(curl -s -X POST $B/services -H 'Content-Type: application/json' -H "Authorization: Bearer $T2" -d '{"templateId":"nodejs-247","name":"user2-bot"}')
SID2=$(echo "$SVC2" | python3 -c 'import sys,json;print(json.load(sys.stdin)["service"]["id"])')
chk "delete own svc" '"ok":true' "$(curl -s -X DELETE $B/services/$SID2 -H "Authorization: Bearer $T2")"
chk "deleted gone" 'not found' "$(curl -s $B/services/$SID2 -H "Authorization: Bearer $T2")"

echo ""
echo "══════════ RESULT: $PASS passed, $FAIL failed ══════════"
