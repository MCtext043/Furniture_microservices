import argparse
import io
import os
import posixpath
import tarfile
import textwrap
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


def run(ssh: paramiko.SSHClient, cmd: str) -> tuple[int, str, str]:
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    return code, out, err


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload and deploy Furniture stack to remote server.")
    parser.add_argument("--host", required=True)
    parser.add_argument("--user", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--port", type=int, default=22)
    parser.add_argument("--remote-dir", default="/root/furniture")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[2]
    archive_bytes = build_archive_bytes(root)

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(args.host, port=args.port, username=args.user, password=args.password, timeout=20)

    try:
        print("== Remote environment check ==")
        for cmd in ("uname -a", "docker --version", "docker compose version", "git --version"):
            code, out, err = run(ssh, cmd)
            print(f"$ {cmd}\n{out or err}".rstrip())
            if code != 0:
                raise RuntimeError(f"Remote command failed: {cmd}\n{err}")

        sftp = ssh.open_sftp()
        remote_archive = "/tmp/furniture-deploy.tar.gz"
        with sftp.open(remote_archive, "wb") as f:
            f.write(archive_bytes)
        sftp.close()
        print(f"Uploaded archive to {remote_archive}")

        cmds = [
            f"mkdir -p {args.remote_dir}",
            f"tar -xzf {remote_archive} -C {args.remote_dir}",
            f"cp {posixpath.join(args.remote_dir, '.env.server.example')} {posixpath.join(args.remote_dir, '.env.server')}",
        ]
        for cmd in cmds:
            code, out, err = run(ssh, cmd)
            if code != 0:
                raise RuntimeError(f"Failed: {cmd}\n{err}")

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

        sftp = ssh.open_sftp()
        with sftp.open(posixpath.join(args.remote_dir, ".env.server"), "w") as f:
            f.write(env_content)
        sftp.close()
        print("Uploaded .env.server")

        deploy_cmd = f"cd {args.remote_dir} && chmod +x scripts/deploy/deploy_server.sh && ./scripts/deploy/deploy_server.sh"
        code, out, err = run(ssh, deploy_cmd)
        print(out)
        if code != 0:
            raise RuntimeError(f"Deploy failed:\n{err}")

        code, out, err = run(ssh, "docker ps --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}'")
        print(out or err)
        print(f"\nDone. Health endpoint: http://{args.host}:8080/health")
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    raise SystemExit(main())
