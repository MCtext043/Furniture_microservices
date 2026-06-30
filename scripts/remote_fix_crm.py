#!/usr/bin/env python3
"""Upload project and run full server deploy (migrate + all services)."""
from __future__ import annotations

import os
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

import paramiko

HOST = "45.11.26.79"
USER = "root"
PASSWORD = os.environ.get("DEPLOY_SSH_PASSWORD", "")
REMOTE_DIR = "/opt/furniture"
REPO_ROOT = Path(__file__).resolve().parents[1]

EXCLUDE_DIRS = {
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    ".cursor",
    "agent-transcripts",
}
EXCLUDE_SUFFIX = {".pyc"}


def log(msg: str) -> None:
    print(msg, flush=True)


def create_archive() -> Path:
    fd, name = tempfile.mkstemp(suffix=".tar.gz")
    os.close(fd)
    archive = Path(name)
    log(f"[1/4] Creating archive {archive} ...")

    def filter_tar(tarinfo: tarfile.TarInfo) -> tarfile.TarInfo | None:
        parts = Path(tarinfo.name).parts
        if parts and parts[0] in EXCLUDE_DIRS:
            return None
        if parts and parts[0] == "deploy" and len(parts) > 1 and parts[1] == "local.env":
            return None
        if tarinfo.name.endswith(tuple(EXCLUDE_SUFFIX)):
            return None
        return tarinfo

    with tarfile.open(archive, "w:gz") as tar:
        for item in REPO_ROOT.iterdir():
            if item.name in EXCLUDE_DIRS:
                continue
            tar.add(item, arcname=item.name, filter=filter_tar)
    log(f"Archive size: {archive.stat().st_size / (1024 * 1024):.1f} MB")
    return archive


def run_remote(client: paramiko.SSHClient, command: str, timeout: int = 900) -> tuple[int, str, str]:
    log(f"$ {command}")
    stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out:
        print(out, end="" if out.endswith("\n") else "\n")
    if err:
        print(err, end="" if err.endswith("\n") else "\n", file=sys.stderr)
    return code, out, err


def main() -> int:
    if not PASSWORD:
        log("Set DEPLOY_SSH_PASSWORD environment variable.")
        return 1

    archive = create_archive()
    secrets = REPO_ROOT / "deploy" / "local.env"
    remote_script = (REPO_ROOT / "deploy" / "remote-deploy.sh").read_text(encoding="utf-8")
    remote_script = remote_script.replace("__REMOTE_DIR__", REMOTE_DIR)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    log(f"[2/4] Connecting to {USER}@{HOST} ...")
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    sftp = client.open_sftp()
    log("[3/4] Uploading archive and deploy script ...")
    sftp.put(str(archive), "/tmp/furniture-deploy.tar.gz")
    if secrets.is_file():
        sftp.put(str(secrets), "/tmp/furniture-secrets.env")
    with sftp.open("/tmp/furniture-deploy-remote.sh", "w") as remote_f:
        remote_f.write(remote_script.replace("\r\n", "\n"))
    sftp.chmod("/tmp/furniture-deploy-remote.sh", 0o755)
    sftp.close()
    archive.unlink(missing_ok=True)

    log("[4/4] Running full deploy on server (migrate + rebuild) ...")
    code, _, _ = run_remote(client, "bash /tmp/furniture-deploy-remote.sh", timeout=1200)
    if code != 0:
        log(f"Deploy failed with exit code {code}")
        client.close()
        return code

    log("Verifying CRM seed-demo ...")
    verify = (
        "TOKEN=$(curl -sS -X POST http://127.0.0.1:${GATEWAY_PORT:-8002}/auth/token "
        "-H 'Content-Type: application/json' "
        "-d '{\"username\":\"admin\",\"password\":\"'\"${AUTH_BOOTSTRAP_PASSWORD:-IVAN123}\"'\"}' "
        "| python3 -c \"import sys,json; print(json.load(sys.stdin).get('access_token',''))\") && "
        "curl -sS -X POST http://127.0.0.1:${GATEWAY_PORT:-8002}/catalog/crm/seed-demo "
        "-H \"Authorization: Bearer $TOKEN\" -H 'Content-Type: application/json' -d '{}'"
    )
    run_remote(
        client,
        f"cd {REMOTE_DIR} && set -a && source .env && set +a && {verify}",
        timeout=120,
    )
    client.close()
    log("Done. Open http://45.11.26.79:8002/admin.html and press Ctrl+F5")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
