import argparse
import io
import posixpath
import sys
import tarfile
import textwrap
import time
from pathlib import Path

import paramiko


def build_archive_bytes(root: Path) -> bytes:
    buf = io.BytesIO()
    ignore_prefixes = {
        ".git",
        ".idea",
        "__pycache__",
        ".pytest_cache",
        ".mypy_cache",
        ".venv",
        "venv",
        "node_modules",
        "agent-transcripts",
    }
    ignore_suffixes = {".pyc", ".pyo", ".log", ".tmp"}

    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for path in root.rglob("*"):
            rel = path.relative_to(root).as_posix()
            if not rel:
                continue
            parts = rel.split("/")
            if any(part in ignore_prefixes for part in parts):
                continue
            if path.is_file() and path.suffix.lower() in ignore_suffixes:
                continue
            tar.add(path, arcname=rel, recursive=False)
    buf.seek(0)
    return buf.read()


def safe_write(text: str) -> None:
    if not text:
        return
    try:
        sys.stdout.write(text)
    except UnicodeEncodeError:
        sys.stdout.write(text.encode("ascii", errors="replace").decode("ascii"))
    sys.stdout.flush()


def log(msg: str) -> None:
    safe_write(f"{msg}\n")


def run_quick(ssh: paramiko.SSHClient, cmd: str) -> tuple[int, str, str]:
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    return code, out, err


def run_stream(ssh: paramiko.SSHClient, cmd: str, hint: str) -> int:
    log("")
    log(f"=== {hint} ===")
    log(f"$ {cmd}")
    log("(output streams live; docker build may take 2-8 minutes)")
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
    channel = stdout.channel

    while not channel.exit_status_ready():
        if channel.recv_ready():
            safe_write(channel.recv(4096).decode("utf-8", errors="replace"))
        else:
            time.sleep(0.15)

    while channel.recv_ready():
        safe_write(channel.recv(4096).decode("utf-8", errors="replace"))

    code = channel.recv_exit_status()
    log(f"=== exit code: {code} ===")
    return code


def compose_cmd(remote_dir: str, *args: str) -> str:
    parts = " ".join(args)
    return (
        f"cd {remote_dir} && "
        f"docker compose --env-file .env.server -f docker-compose.server.yml {parts}"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload and deploy Furniture stack to remote server.")
    parser.add_argument("--host", required=True)
    parser.add_argument("--user", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--port", type=int, default=22)
    parser.add_argument("--remote-dir", default="/root/furniture")
    parser.add_argument("--public-port", type=int, default=8001)
    parser.add_argument(
        "--full",
        action="store_true",
        help="Rebuild and restart all services (slower, ~5-10 min)",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[2]
    mode = "full stack" if args.full else "fast (gateway/frontend only)"
    log(f"== Remote deploy: {mode} ==")
    log(f"Target: {args.user}@{args.host}:{args.public_port}")

    log("[1/7] Building local archive...")
    archive_bytes = build_archive_bytes(root)
    log(f"Archive ready: {len(archive_bytes) / 1024 / 1024:.1f} MB")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    log("[2/7] Connecting via SSH...")
    ssh.connect(args.host, port=args.port, username=args.user, password=args.password, timeout=30)

    try:
        code, out, err = run_quick(ssh, "docker compose version")
        if code != 0:
            raise RuntimeError(f"Docker not available on server:\n{err}")
        log(f"Remote docker: {(out or err).strip()}")

        remote_archive = "/tmp/furniture-deploy.tar.gz"
        log("[3/7] Uploading archive to server...")
        sftp = ssh.open_sftp()
        with sftp.open(remote_archive, "wb") as remote_file:
            remote_file.write(archive_bytes)
        sftp.close()
        log(f"Uploaded -> {remote_archive}")

        log("[4/7] Extracting files on server...")
        for cmd in (
            f"mkdir -p {args.remote_dir}",
            f"tar -xzf {remote_archive} -C {args.remote_dir}",
        ):
            code, _, err = run_quick(ssh, cmd)
            if code != 0:
                raise RuntimeError(f"Failed: {cmd}\n{err}")

        env_path = posixpath.join(args.remote_dir, ".env.server")
        env_content = textwrap.dedent(
            f"""
            PUBLIC_HOST={args.host}
            GATEWAY_PORT=8080
            POSTGRES_USER=furniture
            POSTGRES_PASSWORD={args.password}
            POSTGRES_DB=furniture
            POSTGRES_PORT=5432
            JWT_SECRET_KEY={args.password}_jwt_secret_prod
            JWT_ACCESS_TTL_MINUTES=120
            AUTH_BOOTSTRAP_USERNAME=admin
            AUTH_BOOTSTRAP_PASSWORD={args.password}
            AUTH_BOOTSTRAP_ROLES=admin,catalog:write,planner:write,cutting:run,assets:write
            RABBITMQ_USER=furniture
            RABBITMQ_PASSWORD={args.password}
            RABBITMQ_PORT=5672
            RABBITMQ_MANAGEMENT_PORT=15672
            RABBITMQ_EXCHANGE_EVENTS=furniture.events
            MINIO_ROOT_USER=minioadmin
            MINIO_ROOT_PASSWORD={args.password}
            MINIO_API_PORT=9000
            MINIO_CONSOLE_PORT=9001
            S3_BUCKET=furniture-assets
            AWS_REGION=us-east-1
            CDN_PUBLIC_BASE_URL=
            """
        ).strip() + "\n"

        log("[5/7] Writing .env.server ...")
        sftp = ssh.open_sftp()
        with sftp.open(env_path, "w") as env_file:
            env_file.write(env_content)
        sftp.close()
        log("Done: .env.server")
        log("Next steps run ON THE SERVER (not frozen -- wait for docker output below)")

        patch_cmd = (
            f"cd {args.remote_dir} && "
            f"sed -i 's#- \"\\${{GATEWAY_PORT:-8080}}:8000\"#- \"{args.host}:{args.public_port}:8000\"#' "
            f"docker-compose.server.yml"
        )
        code, _, err = run_quick(ssh, patch_cmd)
        if code != 0:
            raise RuntimeError(f"Compose patch failed:\n{err}")

        if args.full:
            log("[6/7] FULL deploy: rebuild gateway + cutting, restart stack...")
            code = run_stream(
                ssh,
                compose_cmd(args.remote_dir, "build", "gateway-service", "cutting-service"),
                "docker compose build",
            )
            if code != 0:
                raise RuntimeError("docker compose build failed")

            code = run_stream(
                ssh,
                compose_cmd(args.remote_dir, "up", "-d", "--force-recreate"),
                "docker compose up",
            )
            if code != 0:
                raise RuntimeError("docker compose up failed")
        else:
            log("[6/7] FAST deploy: rebuild gateway only (frontend + API proxy)...")
            code = run_stream(
                ssh,
                compose_cmd(args.remote_dir, "build", "gateway-service"),
                "docker compose build gateway-service",
            )
            if code != 0:
                raise RuntimeError("gateway build failed")

            code = run_stream(
                ssh,
                compose_cmd(
                    args.remote_dir,
                    "up",
                    "-d",
                    "--no-deps",
                    "--force-recreate",
                    "gateway-service",
                ),
                "restart gateway-service",
            )
            if code != 0:
                raise RuntimeError("gateway restart failed")

        log("[7/7] Health check...")
        health_url = f"http://{args.host}:{args.public_port}/health"
        code, out, err = run_quick(ssh, f"curl -sS -m 20 {health_url} || true")
        log(f"Health: {(out or err).strip()}")

        code, out, err = run_quick(
            ssh,
            "docker ps --filter name=furniture-gateway --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}'",
        )
        log(out or err)

        log("")
        log("Deploy finished OK.")
        log(f"  Site:   http://{args.host}:{args.public_port}/")
        log(f"  Health: {health_url}")
        log("  Browser: Ctrl+F5 to refresh cache")
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    raise SystemExit(main())
