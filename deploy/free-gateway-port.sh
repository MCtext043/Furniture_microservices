#!/usr/bin/env bash
# Stop Docker containers and stale host processes blocking the gateway port.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

# shellcheck disable=SC1091
set -a
source .env
set +a

PORT="${GATEWAY_PORT:-8002}"
COMPOSE=(docker compose --env-file .env -f docker-compose.server.yml)

port_in_use() {
  command -v ss >/dev/null 2>&1 && ss -tln | grep -q ":${PORT} "
}

collect_listener_pids() {
  ss -tlnp 2>/dev/null | grep ":${PORT} " | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | sort -u
}

stop_host_listeners() {
  if ! port_in_use; then
    return 0
  fi

  echo "Stopping host process on port ${PORT}..."
  ss -tlnp 2>/dev/null | grep ":${PORT} " || true

  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${PORT}/tcp" 2>/dev/null || true
    sleep 1
  fi

  if port_in_use; then
    mapfile -t pids < <(collect_listener_pids)
    for pid in "${pids[@]}"; do
      [[ -n "${pid}" ]] || continue
      echo "SIGTERM pid ${pid}"
      kill "${pid}" 2>/dev/null || true
    done
    sleep 1
    if port_in_use; then
      mapfile -t pids < <(collect_listener_pids)
      for pid in "${pids[@]}"; do
        [[ -n "${pid}" ]] || continue
        echo "SIGKILL pid ${pid}"
        kill -9 "${pid}" 2>/dev/null || true
      done
      sleep 1
    fi
  fi
}

echo "Freeing host port ${PORT} for gateway..."

"${COMPOSE[@]}" stop gateway-service 2>/dev/null || true
"${COMPOSE[@]}" rm -f gateway-service 2>/dev/null || true

mapfile -t ids < <(docker ps -q --filter "publish=${PORT}" 2>/dev/null || true)
if [[ ${#ids[@]} -gt 0 ]]; then
  echo "Stopping Docker containers on port ${PORT}: ${ids[*]}"
  docker stop "${ids[@]}"
  docker rm -f "${ids[@]}" 2>/dev/null || true
fi

stop_host_listeners

if port_in_use; then
  echo ""
  echo "ERROR: port ${PORT} is still in use:"
  ss -tlnp 2>/dev/null | grep ":${PORT} " || true
  exit 1
fi

echo "Port ${PORT} is free."
