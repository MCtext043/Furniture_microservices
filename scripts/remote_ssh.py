#!/usr/bin/env python3
"""Run a command on the remote server via SSH."""
from __future__ import annotations

import os
import sys

import paramiko

HOST = "45.11.26.79"
USER = "root"
PASSWORD = os.environ.get("DEPLOY_SSH_PASSWORD", "")


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: remote_ssh.py <command>", file=sys.stderr)
        return 1
    if not PASSWORD:
        print("Set DEPLOY_SSH_PASSWORD", file=sys.stderr)
        return 1
    cmd = " ".join(sys.argv[1:])
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    _, stdout, stderr = client.exec_command(cmd, timeout=120)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out:
        print(out, end="" if out.endswith("\n") else "\n")
    if err:
        print(err, end="" if err.endswith("\n") else "\n", file=sys.stderr)
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
