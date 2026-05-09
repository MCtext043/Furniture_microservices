#!/usr/bin/env bash
set -e

echo "== listeners =="
ss -ltnp | grep :8001 || true
echo "---"
pid="$(ss -ltnp | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | head -n 1)"
echo "pid=${pid}"
if [ -n "$pid" ]; then
  ps -o pid,ppid,cmd -p "$pid" || true
fi
echo "---"
docker inspect furniture-gateway-service-1 --format '{{json .HostConfig.PortBindings}}'
