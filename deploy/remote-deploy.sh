#!/usr/bin/env bash
# Runs on server after upload-to-server.ps1 (do not run locally).

set -euo pipefail

REMOTE_DIR="__REMOTE_DIR__"
ARCHIVE="/tmp/furniture-deploy.tar.gz"
SECRETS="/tmp/furniture-secrets.env"

echo "== Furniture remote deploy =="
echo "Target dir: ${REMOTE_DIR}"

mkdir -p "${REMOTE_DIR}"
tar -xzf "${ARCHIVE}" -C "${REMOTE_DIR}"

cd "${REMOTE_DIR}"

# Windows uploads may leave CRLF in shell scripts; fix before running.
find deploy -name '*.sh' -type f -print0 2>/dev/null | while IFS= read -r -d '' script; do
  sed -i 's/\r$//' "${script}"
done

if [[ -f "${SECRETS}" ]]; then
  echo "Applying deploy/local.env as server .env ..."
  cp "${SECRETS}" .env
  chmod 600 .env
elif [[ ! -f .env ]]; then
  echo "No .env on server - creating from deploy/server.env.sample"
  cp deploy/server.env.sample .env
fi

chmod +x deploy/install-server.sh deploy/alembic-upgrade.sh deploy/sync-db-password.sh deploy/reset-db.sh deploy/free-gateway-port.sh deploy/sync-admin-password.sh
./deploy/install-server.sh

rm -f "${ARCHIVE}" "${SECRETS}" /tmp/furniture-deploy-remote.sh 2>/dev/null || true

echo "Remote deploy script finished."
