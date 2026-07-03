#!/usr/bin/env python3
import os
import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("45.11.26.79", username="root", password=os.environ["DEPLOY_PASSWORD"], timeout=30)

cmds = [
    "docker ps --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}' | grep furniture",
    "curl -sS -m 8 http://127.0.0.1:8002/health",
    "curl -sS -m 8 http://127.0.0.1:8002/admin.html | grep -n three-bootstrap",
    "curl -sS -m 8 http://127.0.0.1:8002/admin.html | grep -n 'app.js'",
    "curl -sS -m 8 http://127.0.0.1/health",
    "curl -sS -m 8 http://127.0.0.1/admin.html | grep -n three-bootstrap",
    "curl -sS -m 8 http://127.0.0.1/admin.html | grep -n 'app.js'",
    "curl -sS -m 8 http://45.11.26.79/admin.html | grep -n three-bootstrap",
    "curl -sS -m 8 http://45.11.26.79/admin.html | grep -n 'app.js'",
]

for cmd in cmds:
    print("---", cmd)
    _, out, err = ssh.exec_command(cmd)
    print((out.read() + err.read()).decode("utf-8", "replace")[-1500:])

ssh.close()

