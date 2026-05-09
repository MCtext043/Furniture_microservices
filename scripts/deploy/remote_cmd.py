import argparse

import paramiko


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", required=True)
    parser.add_argument("--user", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--port", type=int, default=22)
    parser.add_argument("--cmd")
    parser.add_argument("--cmd-file")
    args = parser.parse_args()
    if not args.cmd and not args.cmd_file:
        raise SystemExit("Either --cmd or --cmd-file is required")
    cmd = args.cmd
    if args.cmd_file:
        with open(args.cmd_file, "r", encoding="utf-8") as f:
            cmd = f.read()

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(args.host, port=args.port, username=args.user, password=args.password, timeout=20)
    try:
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        code = stdout.channel.recv_exit_status()
        if out:
            print(out)
        if err:
            print(err)
        print(f"exit_code={code}")
        return code
    finally:
        ssh.close()


if __name__ == "__main__":
    raise SystemExit(main())
