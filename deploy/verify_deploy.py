#!/usr/bin/env python3
import os
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = "45.11.26.79"


def password() -> str:
    if os.environ.get("DEPLOY_PASSWORD"):
        return os.environ["DEPLOY_PASSWORD"]
    for line in (ROOT / "deploy" / "local.env").read_text(encoding="utf-8").splitlines():
        if line.startswith("POSTGRES_PASSWORD="):
            return line.split("=", 1)[1].strip()
    sys.exit(1)


def run(ssh, cmd: str) -> None:
    _, stdout, stderr = ssh.exec_command(cmd, timeout=30)
    stdout.channel.recv_exit_status()
    print(f"--- {cmd}")
    print((stdout.read() + stderr.read()).decode("utf-8", "replace"))


ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username="root", password=password(), timeout=30)
run(ssh, "cd /opt/furniture && docker compose --env-file .env -f docker-compose.server.yml ps")
run(ssh, "curl -sS -m 8 http://127.0.0.1:8002/health")
run(ssh, "curl -skS -m 8 https://127.0.0.1/health || echo caddy-health-fail")
run(ssh, "grep -o '20260704-user-buttons' /opt/furniture/frontend/index.html")
ssh.close()
