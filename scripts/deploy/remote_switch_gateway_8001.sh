#!/usr/bin/env bash
set -e

if ss -ltnp | grep -q ':8001'; then
  pid="$(ss -ltnp | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | head -n 1)"
  if [ -n "$pid" ]; then
    kill -9 "$pid" || true
  fi
fi

cd /root/furniture
docker compose --env-file .env.server -f docker-compose.server.yml up -d gateway-service
docker compose --env-file .env.server -f docker-compose.server.yml ps gateway-service
curl -sS http://127.0.0.1:8001/health
