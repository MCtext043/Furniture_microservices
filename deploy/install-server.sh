#!/usr/bin/env bash
# Run on server from project root (next to docker-compose.server.yml).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

COMPOSE=(docker compose --env-file .env -f docker-compose.server.yml)

if ! command -v docker >/dev/null 2>&1; then
  echo "Install Docker and Docker Compose v2, then retry."
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Missing .env - copy deploy/server.env.sample and set passwords."
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

if [[ "${RESET_DB:-0}" == "1" ]]; then
  echo "[0/6] RESET_DB=1 - removing old volumes..."
  chmod +x deploy/reset-db.sh
  ./deploy/reset-db.sh
fi

echo "[1/6] docker compose config..."
"${COMPOSE[@]}" config >/dev/null

chmod +x deploy/free-gateway-port.sh

if [[ "${FAST_DEPLOY:-0}" == "1" ]]; then
  echo "[2/6] FAST: rebuild gateway only..."
  ./deploy/free-gateway-port.sh
  "${COMPOSE[@]}" build gateway-service
  "${COMPOSE[@]}" up -d --no-deps --force-recreate gateway-service
else
  echo "[2/6] Starting postgres, rabbitmq, minio..."
  "${COMPOSE[@]}" up -d postgres rabbitmq minio
  echo "Waiting for postgres..."
  for _ in $(seq 1 30); do
    if "${COMPOSE[@]}" exec -T postgres pg_isready -U "${POSTGRES_USER:-furniture}" -d "${POSTGRES_DB:-furniture}" >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done

  echo "[3/6] Sync PostgreSQL password from .env..."
  chmod +x deploy/sync-db-password.sh
  ./deploy/sync-db-password.sh

  echo "[4/6] Database migrations..."
  if ! "${COMPOSE[@]}" run --rm --build migrate; then
    echo ""
    echo "=== MIGRATE FAILED ==="
    "${COMPOSE[@]}" logs migrate 2>/dev/null || true
    echo ""
    echo "Try fresh DB: RESET_DB=1 ./deploy/install-server.sh"
    exit 1
  fi

  echo "[5/6] Starting all services..."
  ./deploy/free-gateway-port.sh
  "${COMPOSE[@]}" up -d --build --force-recreate --remove-orphans

  echo "Syncing admin password from .env..."
  chmod +x deploy/sync-admin-password.sh
  ./deploy/sync-admin-password.sh
fi

echo "[6/6] Status:"
"${COMPOSE[@]}" ps

PORT="${GATEWAY_PORT:-8002}"
echo ""
echo "Done."
echo "  Health: curl -sS http://127.0.0.1:${PORT}/health"
echo "  Site:   http://$(hostname -I | awk '{print $1}'):${PORT}/"
