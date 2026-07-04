#!/usr/bin/env python3
import os
import sys
import time
from pathlib import Path

import paramiko

HOST = os.environ.get("DEPLOY_HOST", "45.11.26.79")
ROOT = Path(__file__).resolve().parents[1]
MINIO_PASSWORD = "furniture-minio-secret"


def password() -> str:
    if os.environ.get("DEPLOY_PASSWORD"):
        return os.environ["DEPLOY_PASSWORD"]
    sys.exit(1)


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 120) -> tuple[int, str]:
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    code = stdout.channel.recv_exit_status()
    return code, (stdout.read() + stderr.read()).decode("utf-8", "replace")


def main() -> int:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=password(), timeout=30)
    steps = [
        "sed -i 's/^MINIO_ROOT_PASSWORD=.*/MINIO_ROOT_PASSWORD=furniture-minio-secret/' /opt/furniture/.env",
        "grep MINIO_ROOT_PASSWORD /opt/furniture/.env",
        "cd /opt/furniture && docker compose --env-file .env -f docker-compose.server.yml stop minio minio-init assets-service",
        "cd /opt/furniture && docker compose --env-file .env -f docker-compose.server.yml rm -f minio minio-init",
        "cd /opt/furniture && docker compose --env-file .env -f docker-compose.server.yml up -d minio",
    ]
    for cmd in steps:
        code, out = run(ssh, cmd)
        print(f"--- exit {code}: {cmd}")
        print(out[-1200:])
        if code != 0:
            ssh.close()
            return code
    time.sleep(6)
    for cmd in [
        "cd /opt/furniture && docker compose --env-file .env -f docker-compose.server.yml up -d minio-init assets-service",
        "cd /opt/furniture && docker compose --env-file .env -f docker-compose.server.yml ps minio assets-service",
        "cd /opt/furniture && docker compose --env-file .env -f docker-compose.server.yml logs --tail=8 minio",
    ]:
        code, out = run(ssh, cmd)
        print(f"--- exit {code}: {cmd}")
        print(out[-1200:])
    ssh.close()
    print("MinIO fix done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
