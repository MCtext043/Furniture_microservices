#!/usr/bin/env python3
import os
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "45.11.26.79")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username="root", password=PASSWORD, timeout=30)
cmds = [
    "curl -sS -m 8 http://45.11.26.79/health",
    "curl -sS -m 8 http://45.11.26.79/catalog/categories | head -c 300",
    'curl -sS -m 8 -X POST http://45.11.26.79/auth/token -H "Content-Type: application/json" -d \'{"username":"admin","password":"IVAN123"}\'',
    "docker ps --format 'table {{.Names}}\t{{.Status}}' | head -15",
    "docker logs furniture-catalog-service-1 --tail 8 2>&1",
]
for c in cmds:
    print("===", c[:80])
    _, o, e = ssh.exec_command(c)
    print((o.read() + e.read()).decode("utf-8", "replace")[:2000])
ssh.close()
