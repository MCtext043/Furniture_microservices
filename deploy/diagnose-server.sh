#!/usr/bin/env bash
# Run on server: bash deploy/diagnose-server.sh

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a
  source .env
  set +a
fi

PORT="${GATEWAY_PORT:-8002}"

echo "=== Docker (furniture) ==="
docker ps -a --filter name=furniture 2>/dev/null || docker ps -a 2>/dev/null || echo "Docker unavailable"

echo ""
echo "=== Health http://127.0.0.1:${PORT}/health ==="
curl -sS -o /dev/null -w "HTTP %{http_code}\n" --connect-timeout 5 "http://127.0.0.1:${PORT}/health" || echo "no response"
curl -sS --connect-timeout 5 "http://127.0.0.1:${PORT}/health" || true
echo ""

echo "=== Listening ports 8001 / 8080 / 8899 ==="
ss -tlnp 2>/dev/null | grep -E ':8001 |:8080 |:8899 ' || true

echo ""
echo "=== UFW ==="
sudo ufw status 2>/dev/null || echo "ufw not used"
