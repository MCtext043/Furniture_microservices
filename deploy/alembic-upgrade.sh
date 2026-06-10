#!/usr/bin/env bash
set -euo pipefail

echo "Running alembic upgrade head..."
set +e
output="$(python -m alembic upgrade head 2>&1)"
code=$?
set -e

if [[ $code -eq 0 ]]; then
  echo "$output"
  echo "Migrations OK."
  exit 0
fi

echo "$output"

if echo "$output" | grep -qi "already exists"; then
  echo "Tables already present — stamping alembic head..."
  python -m alembic stamp head
  exit 0
fi

if echo "$output" | grep -qi "password authentication failed"; then
  echo ""
  echo "ERROR: migrate could not authenticate to PostgreSQL."
  echo "install-server.sh should run deploy/sync-db-password.sh first."
  echo "If this persists, reset the volume: RESET_DB=1 ./deploy/install-server.sh"
  exit 1
fi

exit "$code"
