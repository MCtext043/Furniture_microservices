#!/usr/bin/env bash
# Sync PostgreSQL role password with .env (fixes volume / env mismatch).

set -euo pipefail

escape_sql_literal() {
  printf "%s" "$1" | sed "s/'/''/g"
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

# shellcheck disable=SC1091
set -a
source .env
set +a

COMPOSE=(docker compose --env-file .env -f docker-compose.server.yml)
USER_NAME="${POSTGRES_USER:-furniture}"
PASS_ESCAPED="$(escape_sql_literal "${POSTGRES_PASSWORD}")"

echo "Syncing PostgreSQL password for user ${USER_NAME}..."
"${COMPOSE[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U "${USER_NAME}" -d postgres \
  -c "ALTER USER ${USER_NAME} WITH PASSWORD '${PASS_ESCAPED}';"
echo "PostgreSQL password synced."
