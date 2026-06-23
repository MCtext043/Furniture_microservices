#!/usr/bin/env bash
# Restart auth-service so bootstrap syncs admin password from .env.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

COMPOSE=(docker compose --env-file .env -f docker-compose.server.yml)

echo "Restarting auth-service to sync admin password from .env..."
"${COMPOSE[@]}" up -d --force-recreate --no-deps auth-service
sleep 2
echo "Done. Use AUTH_BOOTSTRAP_USERNAME / AUTH_BOOTSTRAP_PASSWORD from .env"
