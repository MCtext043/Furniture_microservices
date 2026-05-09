#!/usr/bin/env bash
set -e

cd /root/furniture

# Replace generic mapping with explicit public IP mapping to avoid conflict
# with local-only services bound to 127.0.0.1:8001.
sed -i 's#- "${GATEWAY_PORT:-8080}:8000"#- "45.11.26.79:8001:8000"#' docker-compose.server.yml

docker compose --env-file .env.server -f docker-compose.server.yml up -d gateway-service
docker compose --env-file .env.server -f docker-compose.server.yml ps gateway-service
ss -ltnp | grep :8001 || true
curl -sS http://45.11.26.79:8001/health || true
