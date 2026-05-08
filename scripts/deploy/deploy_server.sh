#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.server"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.server.yml"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[ERROR] ${ENV_FILE} not found."
  echo "Create it from template:"
  echo "  cp .env.server.example .env.server"
  echo "  nano .env.server"
  exit 1
fi

echo "[1/4] Checking Docker Compose config..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" config >/dev/null

echo "[2/4] Building images..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" build

echo "[3/4] Starting stack..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d

echo "[4/4] Status:"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps

echo ""
echo "Deployment done."
echo "Gateway health check:"
echo "  curl http://127.0.0.1:\${GATEWAY_PORT:-8080}/health"
