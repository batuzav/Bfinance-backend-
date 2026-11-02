#!/usr/bin/env bash
# Local Postgres lifecycle. Origin: blueprint §19.6. Used by `pnpm db:up|db:down|db:reset`.
#   up    start the container, wait until it accepts connections, ensure libromayor_test exists
#   down  stop the container (data volume kept)
#   reset stop the container AND delete its volume, then run `up` again
# Every sub-command is safe to repeat and exits 0 when there is nothing to do.
set -euo pipefail
cd "$(dirname "$0")/.."

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose -f docker-compose.yml)
else
  COMPOSE=(docker-compose -f docker-compose.yml)
fi

wait_ready() {
  for _ in $(seq 1 60); do
    if docker exec libromayor-db pg_isready -U libromayor -d libromayor >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "postgres did not become ready within 60 s (docker logs libromayor-db)" >&2
  return 1
}

ensure_test_db() {
  if docker exec libromayor-db psql -U libromayor -d libromayor -tAc \
    "SELECT 1 FROM pg_database WHERE datname = 'libromayor_test'" | grep -qx 1; then
    return 0
  fi
  docker exec libromayor-db createdb -U libromayor libromayor_test
}

case "${1:-}" in
  up)
    "${COMPOSE[@]}" up -d
    wait_ready
    ensure_test_db
    echo "postgres ready on localhost:5433 (databases: libromayor, libromayor_test)"
    ;;
  down)
    "${COMPOSE[@]}" down
    ;;
  reset)
    "${COMPOSE[@]}" down -v
    "$0" up
    ;;
  *)
    echo "usage: scripts/db.sh up|down|reset" >&2
    exit 2
    ;;
esac
