#!/usr/bin/env python3
"""Password-based remote deploy (paramiko). Usage:
  set DEPLOY_PASSWORD=...
  python deploy/auto_remote_deploy.py
"""
from __future__ import annotations

import io
import os
import sys
import tarfile
import time
from pathlib import Path

import paramiko

HOST = os.environ.get("DEPLOY_HOST", "45.11.26.79")
USER = os.environ.get("DEPLOY_USER", "root")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
REMOTE_DIR = os.environ.get("DEPLOY_REMOTE_DIR", "/opt/furniture")
ROOT = Path(__file__).resolve().parents[1]

SKIP_DIRS = {
    ".git", ".venv", "venv", "__pycache__", ".pytest_cache", ".cursor",
    "agent-transcripts", "node_modules", ".idea",
}


def log(msg: str) -> None:
    print(msg, flush=True)


def build_archive() -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for path in ROOT.rglob("*"):
            rel = path.relative_to(ROOT).as_posix()
            if not rel:
                continue
            if any(part in SKIP_DIRS for part in rel.split("/")):
                continue
            if rel == "deploy/local.env":
                continue
            if path.suffix == ".pyc":
                continue
            tar.add(path, arcname=rel, recursive=False)
    buf.seek(0)
    return buf.read()


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 3600) -> tuple[int, str, str]:
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    return stdout.channel.recv_exit_status(), out, err


def safe_write(text: str) -> None:
    try:
        sys.stdout.write(text)
    except UnicodeEncodeError:
        sys.stdout.write(text.encode("ascii", errors="replace").decode("ascii"))
    sys.stdout.flush()


def run_stream(ssh: paramiko.SSHClient, cmd: str) -> int:
    log(f"$ {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True, timeout=3600)
    channel = stdout.channel
    while not channel.exit_status_ready():
        if channel.recv_ready():
            safe_write(channel.recv(4096).decode("utf-8", errors="replace"))
        else:
            time.sleep(0.2)
    while channel.recv_ready():
        safe_write(channel.recv(4096).decode("utf-8", errors="replace"))
    code = channel.recv_exit_status()
    log(f"exit {code}")
    return code


def main() -> int:
    if not PASSWORD:
        log("Set DEPLOY_PASSWORD environment variable.")
        return 1

    log(f"== Auto deploy -> {USER}@{HOST}:{REMOTE_DIR} ==")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    try:
        log("[diag] ports 80/443/8002")
        _, out, _ = run(ssh, "ss -tlnp | grep -E ':80 |:443 |:8002 ' || true; docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'")
        log(out)

        log("[1] build archive")
        data = build_archive()
        log(f"    {len(data) / 1024 / 1024:.1f} MB")

        log("[2] upload")
        sftp = ssh.open_sftp()
        sftp.putfo(io.BytesIO(data), "/tmp/furniture-deploy.tar.gz")

        remote_sh = (ROOT / "deploy" / "remote-deploy.sh").read_text(encoding="utf-8")
        remote_sh = remote_sh.replace("__REMOTE_DIR__", REMOTE_DIR)
        with sftp.open("/tmp/furniture-deploy-remote.sh", "w") as f:
            f.write(remote_sh.replace("\r\n", "\n"))

        local_env = ROOT / "deploy" / "local.env"
        if local_env.is_file():
            sftp.put(str(local_env), "/tmp/furniture-secrets.env")
            log("    uploaded deploy/local.env")
        sftp.close()

        log("[3] remote deploy (install-server.sh)")
        code = run_stream(ssh, "bash /tmp/furniture-deploy-remote.sh")
        if code != 0:
            log("Deploy failed.")
            _, out, _ = run(ssh, f"cd {REMOTE_DIR} && docker compose --env-file .env -f docker-compose.server.yml ps -a 2>&1; docker compose --env-file .env -f docker-compose.server.yml logs --tail=30 caddy gateway-service 2>&1")
            log(out)
            return code

        log("[4] health checks")
        for url in (
            "http://127.0.0.1:8002/health",
            "https://127.0.0.1/health",
            f"https://{HOST}/health",
        ):
            _, out, err = run(ssh, f"curl -skS -m 15 {url} || curl -sS -m 15 {url} || true")
            log(f"  {url} -> {(out or err).strip()[:200]}")

        _, out, _ = run(ssh, f"cd {REMOTE_DIR} && docker compose --env-file .env -f docker-compose.server.yml ps")
        log(out)
        log("")
        site = HOST
        _, caddy_out, _ = run(ssh, f"grep -q ':80' {REMOTE_DIR}/deploy/Caddyfile 2>/dev/null && echo http || echo https")
        scheme = (caddy_out or "http").strip()
        log(f"Site: {scheme}://{site}/")
        log(f"Admin: {scheme}://{site}/admin.html")
        if scheme == "http":
            log("Note: bare IP uses HTTP (port 80). HTTPS needs a domain in PUBLIC_DOMAIN.")
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    raise SystemExit(main())
