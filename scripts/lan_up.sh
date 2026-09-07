#!/usr/bin/env bash
# Развернуть Furniture в текущей LAN и напечатать рабочую ссылку.
#   bash scripts/lan_up.sh
#   bash scripts/lan_up.sh --no-build
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if command -v python3 >/dev/null 2>&1; then
  exec python3 "$ROOT/scripts/lan_up.py" "$@"
fi
if command -v python >/dev/null 2>&1; then
  exec python "$ROOT/scripts/lan_up.py" "$@"
fi
echo "Нужен Python 3.9+. Затем: python3 scripts/lan_up.py" >&2
exit 1
