#!/usr/bin/env python3
import os
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "45.11.26.79")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username="root", password=PASSWORD, timeout=30)

cmds = [
    "curl -sS -m 8 http://127.0.0.1/three-bootstrap.js | head -40",
    "curl -sS -m 8 http://127.0.0.1/admin.html | grep -n \"three-bootstrap\" || true",
]

for c in cmds:
    print("===", c)
    _, o, e = ssh.exec_command(c)
    out = (o.read() + e.read()).decode("utf-8", "replace")
    print(out)

ssh.close()

