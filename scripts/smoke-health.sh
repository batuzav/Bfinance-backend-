#!/usr/bin/env bash
# Runs the BUILT API (dist/main.js) with .env.test, waits for GET /health, prints the body and
# stops the server. Exit 0 only when /health answered 200 with "status":"ok" within 30 s.
# Requires `pnpm build` and `pnpm db:up` first. Origin: blueprint §19.6.
set -u
cd "$(dirname "$0")/.."

PORT_VALUE="$(grep -E '^PORT=' .env.test | tail -n1 | cut -d= -f2)"
node --env-file=.env.test dist/main.js > .smoke.log 2>&1 &
PID=$!
trap 'kill "$PID" 2>/dev/null; wait "$PID" 2>/dev/null' EXIT

for _ in $(seq 1 30); do
  RESPONSE="$(curl -s -w '\n%{http_code}' "http://localhost:${PORT_VALUE}/health" || true)"
  CODE="$(printf '%s\n' "$RESPONSE" | tail -n1)"
  BODY="$(printf '%s\n' "$RESPONSE" | head -n1)"
  if [ "$CODE" = "200" ]; then
    printf '%s\n' "$BODY"
    if printf '%s' "$BODY" | grep -q '"status":"ok"'; then
      exit 0
    fi
    echo "/health answered 200 without \"status\":\"ok\"" >&2
    exit 1
  fi
  sleep 1
done

echo "API did not answer /health with 200 within 30 s — see backend/.smoke.log" >&2
exit 1
