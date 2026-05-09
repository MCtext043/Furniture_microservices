#!/usr/bin/env bash
set -e

HASH="$(docker exec furniture-auth-service-1 python -c "from passlib.hash import bcrypt; print(bcrypt.hash('demo123456'))")"

docker exec furniture-postgres-1 psql -U furniture -d furniture -v ON_ERROR_STOP=1 -c "
INSERT INTO auth_users (username, password_hash, roles)
VALUES (
  'admin',
  '${HASH}',
  '[\"admin\",\"catalog:write\",\"planner:write\",\"cutting:run\",\"assets:write\"]'::json
)
ON CONFLICT (username) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    roles = EXCLUDED.roles;
"

echo "check via gateway:"
curl -sS -X POST http://127.0.0.1:8001/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"demo123456"}'
echo
