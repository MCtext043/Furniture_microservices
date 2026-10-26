"""Safely deploy the current Petrov Mebel app files without touching server env or data."""

from __future__ import annotations

import getpass
import io
import posixpath
import sys
import time
from pathlib import Path

import paramiko


HOST = "91.208.84.206"
PORT = 49122
USER = "root"
REMOTE_DIR = "/var/www/petrov_mebel"
FILES = (
    "frontend/app.js",
    "frontend/index.html",
    "frontend/styles.css",
    "frontend/admin.html",
    "frontend/planner/catalog/CatalogThumbnail.js",
    "frontend/planner/pricing/SpreadsheetPricing.js",
    "common/jwt_auth.py",
    "common/staff_permissions.py",
    "common/ru_workdays.py",
    "common/spreadsheet_pricing.py",
    "services/catalog_service/app/crm_routes.py",
    "services/catalog_service/app/delivery.py",
    "services/catalog_service/app/main.py",
    "services/catalog_service/app/models.py",
    "services/catalog_service/app/schemas.py",
    "services/catalog_service/app/stage_reminders.py",
    "alembic/versions/020_assembler_price.py",
)


def remote(ssh: paramiko.SSHClient, command: str, timeout: int = 60) -> tuple[int, str, str]:
    _stdin, stdout, stderr = ssh.exec_command(command, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    return stdout.channel.recv_exit_status(), out, err


def make_remote_dirs(sftp: paramiko.SFTPClient, directory: str) -> None:
    current = ""
    for part in directory.strip("/").split("/"):
        current += "/" + part
        try:
            sftp.stat(current)
        except OSError:
            sftp.mkdir(current)


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    password = getpass.getpass(f"SSH password for {USER}@{HOST}:{PORT}: ")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {HOST}:{PORT}…", flush=True)
    ssh.connect(
        HOST,
        port=PORT,
        username=USER,
        password=password,
        timeout=30,
        banner_timeout=30,
        auth_timeout=30,
        allow_agent=False,
        look_for_keys=False,
    )
    try:
        code, out, err = remote(
            ssh,
            f"test -d {REMOTE_DIR} && test -f {REMOTE_DIR}/.env && "
            f"cd {REMOTE_DIR} && printf 'env=' && sha256sum .env | cut -d' ' -f1 && "
            "printf 'db=' && docker ps --filter name=petrov_mebel-postgres-1 --format '{{.ID}}' && "
            "printf 'migration=' && docker compose --env-file .env -f docker-compose.server.yml "
            "run --rm --entrypoint alembic migrate current",
            timeout=90,
        )
        if code != 0 or not any(version in out for version in ("019_pricing_config (head)", "020_assembler_price (head)")):
            raise RuntimeError(f"Preflight failed; expected migration 019 or 020.\n{out}\n{err}")
        env_hash = next((line[4:].strip() for line in out.splitlines() if line.startswith("env=")), "")
        db_id = next((line[3:].strip() for line in out.splitlines() if line.startswith("db=")), "")
        if not env_hash or not db_id:
            raise RuntimeError(f"Could not verify server env/database identity.\n{out}")
        print("SSH connected; server project, env file and database container verified.")

        timestamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
        backup_dir = posixpath.join(REMOTE_DIR, "backups", f"codex-deploy-{timestamp}")
        sftp = ssh.open_sftp()
        # The browser entrypoint imports these ES modules from /planner-modules/.
        # Deploy the complete runtime tree together so production cannot load a new
        # app.js against stale or missing modules.
        planner_modules = tuple(
            path.relative_to(root).as_posix()
            for path in sorted((root / "frontend" / "planner").rglob("*.js"))
            if not path.name.endswith(".test.js")
        )
        for rel in (*FILES, *planner_modules):
            local_path = root / Path(rel)
            if not local_path.is_file():
                raise FileNotFoundError(local_path)
            remote_path = posixpath.join(REMOTE_DIR, rel)
            try:
                sftp.stat(remote_path)
            except OSError:
                pass
            else:
                backup_path = posixpath.join(backup_dir, rel)
                make_remote_dirs(sftp, posixpath.dirname(backup_path))
                previous = io.BytesIO()
                sftp.getfo(remote_path, previous)
                previous.seek(0)
                sftp.putfo(previous, backup_path)
            make_remote_dirs(sftp, posixpath.dirname(remote_path))
            sftp.put(str(local_path), remote_path)
            print(f"Uploaded {rel}")
        sftp.close()
        print(f"Previous files saved under {backup_dir} where they existed.")

        compose = f"cd {REMOTE_DIR} && docker compose --env-file .env -f docker-compose.server.yml"
        for label, command, timeout in (
            ("Build", f"{compose} build migrate catalog-service auth-service gateway-service", 1200),
            ("Apply additive database migration", f"{compose} run --rm migrate", 300),
            (
                "Restart application services",
                f"{compose} up -d --no-deps --force-recreate gateway-service auth-service catalog-service",
                300,
            ),
        ):
            print(f"{label}…", flush=True)
            code, out, err = remote(ssh, command, timeout=timeout)
            if out:
                print(out, end="", flush=True)
            if err:
                print(err, end="", file=sys.stderr, flush=True)
            if code != 0:
                raise RuntimeError(f"{label} failed with exit code {code}")

        code, out, err = remote(
            ssh,
            f"cd {REMOTE_DIR} && printf 'env=' && sha256sum .env | cut -d' ' -f1 && "
            "printf 'db=' && docker ps --filter name=petrov_mebel-postgres-1 --format '{{.ID}}' && "
            "printf 'migration=' && docker compose --env-file .env -f docker-compose.server.yml "
            "run --rm --entrypoint alembic migrate current && "
            "printf 'gateway=' && curl -fsS --max-time 10 http://127.0.0.1:8082/health && "
            "printf '\ncatalog=' && curl -fsS --max-time 10 http://127.0.0.1:8082/catalog/health && "
            "printf '\nproducts=' && curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "
            "http://127.0.0.1:8082/catalog/products && "
            "printf '\ndomain=' && curl -sk -o /dev/null -w '%{http_code}' --max-time 15 "
            "https://petrovmebel.ru/",
            timeout=90,
        )
        if code != 0:
            raise RuntimeError(f"Post-deploy checks failed.\n{out}\n{err}")
        if f"env={env_hash}" not in out or f"db={db_id}" not in out:
            raise RuntimeError("Server env checksum or database container identity changed.")
        if "020_assembler_price (head)" not in out:
            raise RuntimeError(f"Migration 020 was not verified.\n{out}")
        print(out)
        print("Deployment completed. .env unchanged; database container preserved.")
        return 0
    except Exception as exc:  # Keep failure output clear and avoid printing secrets.
        print(f"Deployment stopped: {exc}", file=sys.stderr)
        return 1
    finally:
        ssh.close()


if __name__ == "__main__":
    raise SystemExit(main())
