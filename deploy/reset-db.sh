#!/usr/bin/env bash
# Remove DB volumes and redeploy (destroys catalog/orders data).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

COMPOSE=(docker compose --env-file .env -f docker-compose.server.yml)

echo "WARNING: this deletes PostgreSQL/MinIO volumes for this compose project."
echo "Stopping stack and removing volumes..."
"${COMPOSE[@]}" down -v
echo "Volumes removed. Run ./deploy/install-server.sh to start fresh."
