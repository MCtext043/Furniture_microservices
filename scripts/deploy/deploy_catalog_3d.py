"""Deploy the local 3D furniture catalog to the existing Petrov Mebel server.

Only static frontend and planner module files are uploaded. Existing server files
are backed up in-place; the server .env and persistent service containers are
checked before and after. No database migration or volume operation is run.
"""

from __future__ import annotations

import getpass
import io
import argparse
import posixpath
import sys
import time
from pathlib import Path

import paramiko


HOST = "91.208.84.206"
PORT = 49122
USER = "root"
REMOTE_DIR = "/var/www/petrov_mebel"
ROOT_FILES = (
    "frontend/app.js",
    "frontend/index.html",
    "frontend/styles.css",
    "frontend/textures3d.js",
)


def run(ssh: paramiko.SSHClient, command: str, timeout: int = 60) -> tuple[int, str, str]:
    _stdin, stdout, stderr = ssh.exec_command(command, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    return stdout.channel.recv_exit_status(), out, err


def ensure_remote_dir(sftp: paramiko.SFTPClient, directory: str) -> None:
    current = ""
    for part in directory.strip("/").split("/"):
        current += "/" + part
        try:
            sftp.stat(current)
        except OSError:
            sftp.mkdir(current)


def fail(label: str, code: int, out: str, err: str) -> None:
    if code:
        details = "\n".join(value for value in (out.strip(), err.strip()) if value)
        raise RuntimeError(f"{label} failed (exit {code}).\n{details}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-only", action="store_true", help="Verify the update without uploading or restarting anything.")
    parser.add_argument("--styles-only", action="store_true", help="Deploy only index.html and styles.css.")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    modules = tuple(
        path.relative_to(root).as_posix()
        for path in sorted((root / "frontend" / "planner").rglob("*.js"))
        if not path.name.endswith(".test.js")
    )
    files = (
        ("frontend/index.html", "frontend/styles.css")
        if args.styles_only
        else (*ROOT_FILES, *modules)
    )
    password = getpass.getpass(f"SSH password for {USER}@{HOST}:{PORT}: ")
    ssh = paramiko.SSHClient()
    ssh.load_system_host_keys()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {HOST}:{PORT}…", flush=True)

    try:
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
        print("SSH connection established.", flush=True)

        compose = f"cd {REMOTE_DIR} && docker compose --env-file .env -f docker-compose.server.yml"
        if args.verify_only:
            verify_only = (
                f"set -e; cd {REMOTE_DIR}; printf 'env='; sha256sum .env | cut -d' ' -f1; "
                f"printf 'db='; {compose} ps -q postgres; "
                f"printf 'gateway='; {compose} ps -q gateway-service; "
                "printf 'health='; curl --retry 10 --retry-all-errors --retry-delay 2 -fsS "
                "--max-time 10 http://127.0.0.1:8082/health; "
                "printf '\nindex='; curl --retry 10 --retry-all-errors --retry-delay 2 -fsS "
                "--max-time 10 http://127.0.0.1:8082/ | "
                "grep -o 'styles.css?v=20261026-object-catalog' | head -n1; "
                "printf 'button-style='; curl --retry 10 --retry-all-errors --retry-delay 2 -fsS "
                "--max-time 10 'http://127.0.0.1:8082/styles.css?v=20261026-object-catalog' | "
                "grep -o '\\.object-catalog-trigger {' | head -n1; "
                "printf 'catalog='; curl --retry 10 --retry-all-errors --retry-delay 2 -fsS "
                "--max-time 10 http://127.0.0.1:8082/planner-modules/catalog/HardFurnitureCatalog.js | "
                "grep -o 'Тумба с четырьмя ящиками' | head -n1"
            )
            code, out, err = run(ssh, verify_only, timeout=120)
            if code:
                _log_code, logs, log_err = run(ssh, f"{compose} logs --tail=50 gateway-service", timeout=60)
                details = "\n".join(part.strip() for part in (out, err, logs, log_err) if part.strip())
                raise RuntimeError(f"Verification failed.\n{details}")
            print(out)
            print("Verification passed; no files were uploaded or services restarted.")
            return 0

        preflight = (
            f"set -e; test -d {REMOTE_DIR}; test -f {REMOTE_DIR}/.env; "
            f"cd {REMOTE_DIR}; printf 'env='; sha256sum .env | cut -d' ' -f1; "
            f"printf 'db='; {compose} ps -q postgres; "
            f"printf 'gateway='; {compose} ps -q gateway-service; "
            "printf 'health='; curl -fsS --max-time 10 http://127.0.0.1:8082/health"
        )
        code, out, err = run(ssh, preflight, timeout=90)
        fail("Server preflight", code, out, err)
        values = dict(line.split("=", 1) for line in out.splitlines() if "=" in line)
        env_hash = values.get("env", "").strip()
        db_id = values.get("db", "").strip()
        gateway_id = values.get("gateway", "").strip()
        if not env_hash or not db_id or not gateway_id:
            raise RuntimeError(f"Could not verify server .env/database/gateway before deployment.\n{out}")
        print("Preflight passed: project and gateway are running; env and database identity recorded.")

        timestamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
        backup_dir = posixpath.join(REMOTE_DIR, "backups", f"codex-catalog-3d-{timestamp}")
        sftp = ssh.open_sftp()
        try:
            for rel in files:
                local_path = root / Path(rel)
                if not local_path.is_file():
                    raise FileNotFoundError(local_path)
                remote_path = posixpath.join(REMOTE_DIR, rel)
                ensure_remote_dir(sftp, posixpath.dirname(remote_path))
                try:
                    sftp.stat(remote_path)
                except OSError:
                    pass
                else:
                    backup_path = posixpath.join(backup_dir, rel)
                    ensure_remote_dir(sftp, posixpath.dirname(backup_path))
                    previous = io.BytesIO()
                    sftp.getfo(remote_path, previous)
                    previous.seek(0)
                    sftp.putfo(previous, backup_path)
                sftp.put(str(local_path), remote_path)
                print(f"Uploaded {rel}")
        finally:
            sftp.close()
        print(f"Previous files backed up at {backup_dir}")

        for label, command, timeout in (
            ("Build frontend gateway image", f"{compose} build gateway-service", 1200),
            (
                "Recreate gateway only",
                f"{compose} up -d --no-deps --force-recreate gateway-service",
                300,
            ),
        ):
            print(f"{label}…", flush=True)
            code, out, err = run(ssh, command, timeout=timeout)
            if out:
                print(out, end="", flush=True)
            if err:
                print(err, end="", file=sys.stderr, flush=True)
            fail(label, code, out, err)

        verify = (
            f"set -e; cd {REMOTE_DIR}; printf 'env='; sha256sum .env | cut -d' ' -f1; "
            f"printf 'db='; {compose} ps -q postgres; "
            f"printf 'gateway='; {compose} ps -q gateway-service; "
            "printf 'health='; curl --retry 10 --retry-all-errors --retry-delay 2 -fsS "
            "--max-time 10 http://127.0.0.1:8082/health; "
            "printf '\nindex='; curl --retry 10 --retry-all-errors --retry-delay 2 -fsS "
            "--max-time 10 http://127.0.0.1:8082/ | "
            "grep -o 'styles.css?v=20261026-object-catalog' | head -n1; "
            "printf 'button-style='; curl --retry 10 --retry-all-errors --retry-delay 2 -fsS "
            "--max-time 10 'http://127.0.0.1:8082/styles.css?v=20261026-object-catalog' | "
            "grep -o '\\.object-catalog-trigger {' | head -n1; "
            "printf 'catalog='; curl --retry 10 --retry-all-errors --retry-delay 2 -fsS "
            "--max-time 10 "
            "http://127.0.0.1:8082/planner-modules/catalog/HardFurnitureCatalog.js | "
            "grep -o 'Тумба с четырьмя ящиками' | head -n1"
        )
        code, out, err = run(ssh, verify, timeout=90)
        fail("Post-deploy verification", code, out, err)
        if f"env={env_hash}" not in out or f"db={db_id}" not in out:
            raise RuntimeError("Post-deploy .env hash or database container identity changed.")
        if f"gateway={gateway_id}" in out:
            raise RuntimeError("Gateway container was not recreated as expected.")
        print(out)
        print("Deployment verified: .env and database container preserved; gateway updated, no migration run.")
        return 0
    except Exception as exc:  # Keep failures clear and never print the SSH password.
        print(f"Deployment stopped: {exc}", file=sys.stderr)
        return 1
    finally:
        ssh.close()


if __name__ == "__main__":
    raise SystemExit(main())
