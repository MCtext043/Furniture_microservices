#!/usr/bin/env bash
set -e

echo "demo123456 ->"
curl -sS -X POST http://127.0.0.1:8001/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"demo123456"}'
echo
echo "server-pass ->"
curl -sS -X POST http://127.0.0.1:8001/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"2vg2lDPcIA"}'
echo
