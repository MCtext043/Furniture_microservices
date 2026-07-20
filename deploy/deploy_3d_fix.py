#!/usr/bin/env python3
"""Quick deploy: frontend + tier selection backend + migrations."""
import io
import os
import sys
import tarfile
from pathlib import Path

import paramiko

HOST = os.environ.get("DEPLOY_HOST", "45.11.26.79")
ROOT = Path(__file__).resolve().parents[1]

FILES = [
    "frontend/app.js",
    "frontend/admin.html",
    "frontend/index.html",
    "frontend/styles.css",
    "frontend/textures3d.js",
    "common/pricing.py",
    "services/planner_service/app/main.py",
    "services/planner_service/app/models.py",
    "services/planner_service/app/schemas.py",
    "services/catalog_service/app/crm_routes.py",
    "services/catalog_service/app/models.py",
    "services/catalog_service/app/schemas.py",
    "services/assets_service/app/main.py",
    "services/cutting_service/app/main.py",
    "services/cutting_service/app/models.py",
    "services/cutting_service/app/schemas.py",
    "alembic/versions/005_cutting_job_result.py",
    "alembic/versions/006_selected_tier.py",
    "alembic/versions/007_product_photos.py",
]


def deploy_password() -> str:
    if os.environ.get("DEPLOY_PASSWORD"):
        return os.environ["DEPLOY_PASSWORD"]
    local_env = ROOT / "deploy" / "local.env"
    if local_env.is_file():
        for line in local_env.read_text(encoding="utf-8").splitlines():
            if line.startswith("POSTGRES_PASSWORD="):
                return line.split("=", 1)[1].strip()
    print("Set DEPLOY_PASSWORD or create deploy/local.env", file=sys.stderr)
    sys.exit(1)


def main() -> int:
    password = deploy_password()
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=password, timeout=30)

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for rel in FILES:
            path = ROOT / rel
            if not path.is_file():
                print(f"Missing: {rel}", file=sys.stderr)
                return 1
            tar.add(path, arcname=rel)
    buf.seek(0)

    sftp = ssh.open_sftp()
    sftp.putfo(buf, "/tmp/furniture-quick.tar.gz")
    sftp.close()

    cmds = [
        "cd /opt/furniture && tar -xzf /tmp/furniture-quick.tar.gz",
        (
            "cd /opt/furniture && docker compose --env-file .env -f docker-compose.server.yml "
            "build migrate planner-service catalog-service cutting-service assets-service gateway-service"
        ),
        "cd /opt/furniture && docker compose --env-file .env -f docker-compose.server.yml run --rm migrate",
        (
            "cd /opt/furniture && docker compose --env-file .env -f docker-compose.server.yml "
            "up -d --no-deps --force-recreate planner-service catalog-service cutting-service assets-service gateway-service"
        ),
        "curl -skS -m 12 https://127.0.0.1/health || curl -sS -m 12 http://127.0.0.1:8002/health",
        "grep -o '20260707-projects-crm' /opt/furniture/frontend/index.html || true",
    ]

    failed = False
    for cmd in cmds:
        _, stdout, stderr = ssh.exec_command(cmd, timeout=600)
        code = stdout.channel.recv_exit_status()
        out = (stdout.read() + stderr.read()).decode("utf-8", "replace")
        print(f"--- exit {code}: {cmd}")
        print(out[-2000:])
        if code != 0 and "health" not in cmd:
            failed = True

    ssh.close()
    if failed:
        return 1
    print(f"\nDeploy OK: https://{HOST}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
