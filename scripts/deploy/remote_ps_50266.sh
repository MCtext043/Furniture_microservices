#!/usr/bin/env bash
set -e
ps -o pid,ppid,user,cmd -p 50266 || true
echo "---"
ps -o pid,ppid,user,cmd -p "$(ps -o ppid= -p 50266 | tr -d ' ')" || true
