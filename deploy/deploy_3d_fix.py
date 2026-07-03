#!/usr/bin/env python3
import io
import os
import tarfile
from pathlib import Path

import paramiko

HOST = os.environ.get("DEPLOY_HOST", "45.11.26.79")
PASSWORD = os.environ["DEPLOY_PASSWORD"]
ROOT = Path(__file__).resolve().parents[1]

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username="root", password=PASSWORD, timeout=30)

buf = io.BytesIO()
with tarfile.open(fileobj=buf, mode="w:gz") as tar:
    for rel in [
        "frontend/app.js",
        "frontend/admin.html",
        "frontend/index.html",
        "frontend/textures3d.js",
    ]:
        tar.add(ROOT / rel, arcname=rel)
buf.seek(0)

sftp = ssh.open_sftp()
sftp.putfo(buf, "/tmp/3d-final.tar.gz")
sftp.close()

cmds = [
    "cd /opt/furniture && tar -xzf /tmp/3d-final.tar.gz",
    "cd /opt/furniture && docker compose --env-file .env -f docker-compose.server.yml build gateway-service",
    "cd /opt/furniture && docker compose --env-file .env -f docker-compose.server.yml up -d --no-deps --force-recreate gateway-service",
    "curl -sS -m 8 http://127.0.0.1/health",
    "grep -c 'three.min.js' /opt/furniture/frontend/index.html",
    "curl -sS -m 8 http://127.0.0.1/index.html | grep -n 'webgl-fix'",
]

for cmd in cmds:
    _, stdout, stderr = ssh.exec_command(cmd)
    code = stdout.channel.recv_exit_status()
    out = (stdout.read() + stderr.read()).decode("utf-8", "replace")
    print(f"--- exit {code}: {cmd}")
    print(out[-1200:])

ssh.close()

