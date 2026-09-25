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
PORT = int(os.environ.get("DEPLOY_PORT", "22"))
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

    log(f"== Auto deploy -> {USER}@{HOST}:{PORT} {REMOTE_DIR} ==")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(
        HOST,
        port=PORT,
        username=USER,
        password=PASSWORD,
        timeout=40,
        banner_timeout=40,
        auth_timeout=40,
        allow_agent=False,
        look_for_keys=False,
    )

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
        prefix = "export RESET_DB=0\n"
        if os.environ.get("FAST_DEPLOY") == "1":
            prefix += "export FAST_DEPLOY=1\n"
            log("    FAST_DEPLOY=1 (gateway/frontend only)")
        if os.environ.get("RESET_DB") == "1":
            prefix = "export RESET_DB=1\n"
            log("    RESET_DB=1 (wipes PostgreSQL)")
        remote_sh = prefix + remote_sh
        with sftp.open("/tmp/furniture-deploy-remote.sh", "w") as f:
            f.write(remote_sh.replace("\r\n", "\n"))

        local_env = ROOT / "deploy" / "local.env"
        keep_remote_env = os.environ.get("KEEP_REMOTE_ENV", "1") == "1"
        if local_env.is_file() and not keep_remote_env:
            sftp.put(str(local_env), "/tmp/furniture-secrets.env")
            log("    uploaded deploy/local.env")
        elif keep_remote_env:
            log("    KEEP_REMOTE_ENV=1 (server .env will not be overwritten)")
        sftp.close()

        log("[3] remote deploy (install-server.sh, RESET_DB=0)")
        if os.environ.get("DEPLOY_NOHUP") == "1":
            run(ssh, "pkill -f furniture-deploy-remote.sh >/dev/null 2>&1 || true")
            code, out, err = run(
                ssh,
                "nohup bash /tmp/furniture-deploy-remote.sh >/tmp/furniture-deploy.log 2>&1 & echo $!",
            )
            pid = (out or "").strip().splitlines()[-1] if out else ""
            log(f"    background pid {pid}")
            if not pid.isdigit():
                log(err or "failed to start remote deploy")
                return 1
            deadline = time.time() + 3600
            last_size = 0
            while time.time() < deadline:
                time.sleep(15)
                st, status, _ = run(ssh, "ps -p %s >/dev/null 2>&1 && echo RUNNING || echo DONE" % pid)
                st, tail, _ = run(ssh, "tail -n 12 /tmp/furniture-deploy.log")
                safe_write((tail or "") + "\n")
                alive = "RUNNING" in (status or "")
                if alive:
                    continue
                st, body, _ = run(ssh, "grep -F 'Remote deploy script finished.' /tmp/furniture-deploy.log || true")
                if "Remote deploy script finished." in (body or ""):
                    code = 0
                    break
                log("Remote process ended before finish marker.")
                st, exitline, _ = run(ssh, "tail -n 40 /tmp/furniture-deploy.log")
                log(exitline)
                return 1
            else:
                log("Remote deploy timed out.")
                return 1
        else:
            code = run_stream(ssh, "bash /tmp/furniture-deploy-remote.sh")
        if code != 0:
            log("Deploy failed.")
            _, out, _ = run(ssh, f"cd {REMOTE_DIR} && docker compose --env-file .env -f docker-compose.server.yml ps -a 2>&1; docker compose --env-file .env -f docker-compose.server.yml logs --tail=30 caddy gateway-service 2>&1")
            log(out)
            return code

        extra = os.environ.get("REBUILD_SERVICES", "").strip()
        if extra:
            services = " ".join(extra.split())
            compose = f"cd {REMOTE_DIR} && docker compose --env-file .env -f docker-compose.server.yml"
            log(f"[3b] rebuild extra services: {services}")
            code = run_stream(ssh, f"{compose} build {services} && {compose} up -d --no-deps --force-recreate {services}")
            if code != 0:
                log("Extra service rebuild failed.")
                return code

        log("[4] health checks")
        gateway_port = os.environ.get("GATEWAY_PORT", "8082")
        for url in (
            f"http://127.0.0.1:{gateway_port}/health",
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
