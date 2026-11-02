#!/usr/bin/env bash
# Manual backup (decision D4a). Dumps the database at DATABASE_URL_DIRECT (falls back to DATABASE_URL)
# into backups/<UTC timestamp>.sql using pg_dump from the postgres:17-alpine image, so no local
# pg_dump is needed. backups/ is git-ignored. Origin: blueprint §19.6.
#   pnpm backup                                   # reads backend/.env
#   DATABASE_URL_DIRECT='postgres://…' pnpm backup  # shell value wins over .env
# For the local docker database use host.docker.internal instead of localhost in the URL.
set -euo pipefail
cd "$(dirname "$0")/.."

read_env() {
  if [ -f .env ]; then
    grep -E "^$1=" .env | tail -n1 | cut -d= -f2- || true
  fi
}

URL="${DATABASE_URL_DIRECT:-$(read_env DATABASE_URL_DIRECT)}"
if [ -z "$URL" ]; then
  URL="${DATABASE_URL:-$(read_env DATABASE_URL)}"
fi
if [ -z "$URL" ]; then
  echo "Set DATABASE_URL_DIRECT (or DATABASE_URL) in backend/.env or in the shell" >&2
  exit 2
fi

mkdir -p backups
OUT="backups/libromayor-$(date -u +%Y%m%dT%H%M%SZ).sql"
docker run --rm postgres:17-alpine pg_dump --no-owner --no-privileges "$URL" > "$OUT"
echo "wrote $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"
