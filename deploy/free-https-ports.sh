#!/usr/bin/env bash
# Free ports 80/443 for Caddy (HTTPS reverse proxy).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

# shellcheck disable=SC1091
set -a
source .env
set +a

if [[ "${HTTPS_ENABLED:-0}" != "1" ]]; then
  exit 0
fi

COMPOSE=(docker compose --env-file .env -f docker-compose.server.yml)

port_in_use() {
  local port="$1"
  command -v ss >/dev/null 2>&1 && ss -tln | grep -qE ":${port}([[:space:]]|$)"
}

collect_listener_pids() {
  local port="$1"
  ss -tlnp 2>/dev/null | grep -E ":${port}([[:space:]]|$)" | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | sort -u
}

stop_docker_on_port() {
  local port="$1"
  mapfile -t ids < <(docker ps -q --filter "publish=${port}" 2>/dev/null || true)
  if [[ ${#ids[@]} -gt 0 ]]; then
    echo "Stopping Docker containers on port ${port}: ${ids[*]}"
    docker stop "${ids[@]}" 2>/dev/null || true
    docker rm -f "${ids[@]}" 2>/dev/null || true
  fi
}

stop_common_web_servers() {
  if command -v systemctl >/dev/null 2>&1; then
    for svc in nginx apache2 httpd caddy; do
      if systemctl is-active --quiet "${svc}" 2>/dev/null; then
        echo "Stopping systemd service: ${svc}"
        systemctl stop "${svc}" 2>/dev/null || true
      fi
    done
  fi
}

stop_host_listeners() {
  local port="$1"
  if ! port_in_use "${port}"; then
    return 0
  fi

  echo "Stopping host process on port ${port}..."
  ss -tlnp 2>/dev/null | grep -E ":${port}([[:space:]]|$)" || true

  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
    sleep 1
  fi

  if port_in_use "${port}"; then
    mapfile -t pids < <(collect_listener_pids "${port}")
    for pid in "${pids[@]}"; do
      [[ -n "${pid}" ]] || continue
      echo "SIGTERM pid ${pid} (port ${port})"
      kill "${pid}" 2>/dev/null || true
    done
    sleep 1
  fi

  if port_in_use "${port}"; then
    mapfile -t pids < <(collect_listener_pids "${port}")
    for pid in "${pids[@]}"; do
      [[ -n "${pid}" ]] || continue
      echo "SIGKILL pid ${pid} (port ${port})"
      kill -9 "${pid}" 2>/dev/null || true
    done
    sleep 1
  fi
}

free_port() {
  local port="$1"
  echo "Freeing host port ${port} for Caddy..."

  "${COMPOSE[@]}" stop caddy 2>/dev/null || true
  "${COMPOSE[@]}" rm -f caddy 2>/dev/null || true

  stop_common_web_servers
  stop_docker_on_port "${port}"
  stop_host_listeners "${port}"

  if port_in_use "${port}"; then
    echo ""
    echo "ERROR: port ${port} is still in use:"
    ss -tlnp 2>/dev/null | grep -E ":${port}([[:space:]]|$)" || true
    echo ""
    echo "On the server run:"
    echo "  ss -tlnp | grep ':${port}'"
    echo "  systemctl stop nginx apache2 2>/dev/null; docker ps --filter publish=${port}"
    return 1
  fi

  echo "Port ${port} is free."
}

echo "== Free HTTPS ports 80/443 =="
free_port 80
free_port 443
echo "HTTPS ports 80/443 ready."
