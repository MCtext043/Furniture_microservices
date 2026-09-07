#!/usr/bin/env python3
"""Поднять Furniture в Docker и напечатать ссылку для устройств в текущей сети."""

from __future__ import annotations

import argparse
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PORT_VARS = [
    ("GATEWAY_HOST_PORT", 8080),
    ("POSTGRES_HOST_PORT", 5432),
    ("RABBITMQ_HOST_PORT", 5672),
    ("RABBITMQ_MGMT_PORT", 15672),
    ("MINIO_API_PORT", 9000),
    ("MINIO_CONSOLE_PORT", 9001),
    ("CATALOG_HOST_PORT", 8001),
    ("CUTTING_HOST_PORT", 8002),
    ("PLANNER_HOST_PORT", 8003),
    ("AUTH_HOST_PORT", 8004),
    ("ASSETS_HOST_PORT", 8005),
]

SKIP_IP_PREFIXES = (
    "127.",
    "169.254.",
    "172.17.",
    "172.18.",
    "172.19.",
    "172.20.",
    "172.21.",
    "172.22.",
)
# Radmin / Hamachi / typical VPN ranges — not the home Wi-Fi the phone uses.
VPN_IP_PREFIXES = ("26.", "25.", "5.")


def configure_stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, OSError):
            pass


def log(message: str) -> None:
    print(message, flush=True)


def fail(message: str, code: int = 1) -> None:
    print(f"Ошибка: {message}", file=sys.stderr, flush=True)
    raise SystemExit(code)


def docker_cmd() -> list[str]:
    if not shutil.which("docker"):
        fail("Docker не найден. Установите Docker Desktop / Docker Engine и повторите.")
    probe = subprocess.run(
        ["docker", "compose", "version"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if probe.returncode == 0:
        return ["docker", "compose"]
    if shutil.which("docker-compose"):
        return ["docker-compose"]
    fail("Нужен Docker Compose (команда `docker compose`).")


def run_docker(compose: list[str], args: list[str], env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    merged = os.environ.copy()
    if env:
        merged.update(env)
    return subprocess.run(
        [*compose, *args],
        cwd=ROOT,
        env=merged,
        capture_output=True,
        text=True,
    )


def _published_ports_from_docker() -> set[int]:
    ports: set[int] = set()
    result = subprocess.run(
        ["docker", "ps", "--format", "{{.Ports}}"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return ports
    for line in result.stdout.splitlines():
        for match in line.replace(",", " ").split():
            # 0.0.0.0:5432->5432/tcp  or  [::]:8080->8000/tcp
            if "->" not in match:
                continue
            host = match.split("->", 1)[0]
            if ":" not in host:
                continue
            try:
                ports.add(int(host.rsplit(":", 1)[1]))
            except ValueError:
                continue
    return ports


def compose_published_ports(compose: list[str]) -> set[int]:
    result = run_docker(compose, ["ps", "--format", "{{.Ports}}"])
    if result.returncode != 0:
        return set()
    owned: set[int] = set()
    for line in result.stdout.splitlines():
        for match in line.replace(",", " ").split():
            if "->" not in match:
                continue
            host = match.split("->", 1)[0]
            if ":" not in host:
                continue
            try:
                owned.add(int(host.rsplit(":", 1)[1]))
            except ValueError:
                continue
    return owned


def http_ok(url: str, timeout: float = 3.0) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return 200 <= response.status < 400
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def wait_health(port: int, seconds: int = 90) -> bool:
    url = f"http://127.0.0.1:{port}/health"
    deadline = time.time() + seconds
    while time.time() < deadline:
        if http_ok(url):
            return True
        time.sleep(2)
    return False


def primary_lan_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("1.1.1.1", 80))
        ip = sock.getsockname()[0]
    except OSError:
        ip = "127.0.0.1"
    finally:
        sock.close()
    return ip


VIRTUAL_IFACE_HINTS = (
    "vmware",
    "vmnet",
    "virtualbox",
    "vethernet",
    "hyper-v",
    "wsl",
    "docker",
    "radmin",
    "vpn",
    "tun",
    "tap",
    "loopback",
    "hamachi",
    "happ-tun",
)


def extra_ipv4() -> list[tuple[str, str, str]]:
    found: list[tuple[str, str, str]] = []

    def add(ip: str, iface: str = "", origin: str = "") -> None:
        ip = ip.strip()
        if not ip or any(ip.startswith(prefix) for prefix in SKIP_IP_PREFIXES):
            return
        item = (ip, iface, origin)
        if item not in found:
            found.append(item)

    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            add(info[4][0])
    except OSError:
        pass
    if sys.platform.startswith("win"):
        probe = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "[Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8; "
                "Get-NetIPAddress -AddressFamily IPv4 | "
                "Where-Object { $_.PrefixOrigin -ne 'WellKnown' } | "
                "ForEach-Object { '{0}|{1}|{2}' -f $_.IPAddress, $_.InterfaceAlias, $_.PrefixOrigin }",
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if probe.returncode == 0:
            for line in probe.stdout.splitlines():
                parts = [part.strip() for part in line.split("|")]
                if len(parts) >= 3:
                    add(parts[0], parts[1], parts[2])
                elif parts and parts[0]:
                    add(parts[0])
    else:
        ip_bin = shutil.which("ip")
        if ip_bin:
            probe = subprocess.run(
                [ip_bin, "-4", "-o", "addr", "show"],
                capture_output=True,
                text=True,
            )
            if probe.returncode == 0:
                for line in probe.stdout.splitlines():
                    parts = line.split()
                    iface = parts[1] if len(parts) > 1 else ""
                    if "inet" in parts:
                        idx = parts.index("inet")
                        if idx + 1 < len(parts):
                            add(parts[idx + 1].split("/", 1)[0], iface)
    return found


def _lan_score(ip: str, iface: str = "", origin: str = "") -> int:
    name = iface.lower()
    if any(ip.startswith(prefix) for prefix in SKIP_IP_PREFIXES + VPN_IP_PREFIXES):
        return -100
    if any(hint in name for hint in VIRTUAL_IFACE_HINTS):
        return -80
    if ip.startswith("192.168.56.") or ip.startswith("192.168.137."):
        return -50
    score = 0
    if ip.startswith("192.168."):
        score += 80
    elif ip.startswith("10."):
        score += 50
    elif ip.startswith("172."):
        try:
            second = int(ip.split(".")[1])
        except (IndexError, ValueError):
            second = -1
        if 16 <= second <= 31:
            score += 20
    if origin.lower() == "dhcp":
        score += 40
    if any(hint in name for hint in ("wi-fi", "wifi", "wlan", "ethernet", "беспровод", "локальн")):
        score += 25
    return score


def choose_lan_ip() -> tuple[str, list[str]]:
    routed = primary_lan_ip()
    candidates = extra_ipv4()
    if routed:
        candidates.append((routed, "", ""))
    ranked = sorted(candidates, key=lambda item: _lan_score(*item), reverse=True)
    unique: list[str] = []
    for ip, _iface, _origin in ranked:
        if ip not in unique:
            unique.append(ip)
    if not unique:
        return routed or "127.0.0.1", []
    primary = unique[0] if _lan_score(unique[0]) > 0 else routed or "127.0.0.1"
    rest = [ip for ip in unique if ip != primary]
    return primary, rest


def try_open_firewall(port: int) -> str:
    name = f"Furniture LAN {port}"
    if sys.platform.startswith("win"):
        show = subprocess.run(
            ["netsh", "advfirewall", "firewall", "show", "rule", f"name={name}"],
            capture_output=True,
            text=True,
        )
        if show.returncode == 0 and name.lower() in show.stdout.lower():
            return "правило брандмауэра уже есть"
        added = subprocess.run(
            [
                "netsh",
                "advfirewall",
                "firewall",
                "add",
                "rule",
                f"name={name}",
                "dir=in",
                "action=allow",
                "protocol=TCP",
                f"localport={port}",
            ],
            capture_output=True,
            text=True,
        )
        if added.returncode == 0:
            return "разрешён входящий TCP в брандмауэре Windows"
        return (
            "не удалось открыть брандмауэр (нужны права администратора). "
            f"Если телефон не откроет сайт, разрешите входящий TCP {port}"
        )
    ufw = shutil.which("ufw")
    if ufw:
        status = subprocess.run([ufw, "status"], capture_output=True, text=True)
        if status.returncode == 0 and "inactive" not in status.stdout.lower():
            allow = subprocess.run(
                [ufw, "allow", f"{port}/tcp"],
                capture_output=True,
                text=True,
            )
            if allow.returncode == 0:
                return "порт добавлен в ufw"
            return f"ufw не дал открыть порт {port} — добавьте правило вручную"
    return "системный брандмауэр не трогали"


def allocate_ports(compose: list[str], gateway_preferred: int) -> dict[str, str]:
    taken: set[int] = set()
    env: dict[str, str] = {}
    published = _published_ports_from_docker()
    ours = compose_published_ports(compose)

    def busy(port: int) -> bool:
        if port in ours:
            return False
        if port in published:
            return True
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.2)
            if sock.connect_ex(("127.0.0.1", port)) == 0:
                return True
        return False

    def pick(preferred: int) -> int:
        if preferred not in taken and not busy(preferred):
            taken.add(preferred)
            return preferred
        for candidate in range(preferred + 1, preferred + 40):
            if candidate in taken or busy(candidate):
                continue
            taken.add(candidate)
            return candidate
        fail(f"Не удалось подобрать свободный порт около {preferred}.")

    for name, default in PORT_VARS:
        preferred = gateway_preferred if name == "GATEWAY_HOST_PORT" else default
        env[name] = str(pick(preferred))
    return env


def print_links(ip: str, port: int, extras: list[str]) -> None:
    base = f"http://{ip}:{port}"
    log("")
    log("=" * 56)
    log(f"  Рабочая ссылка:  {base}/")
    log(f"  Админка:         {base}/admin.html")
    log(f"  На этом ПК:      http://127.0.0.1:{port}/")
    log("=" * 56)
    log("")
    log("Логин админа: admin / demo123456")
    log("Телефон должен быть в той же Wi-Fi / LAN, что и этот компьютер.")
    if extras:
        log("Другие адреса этой машины (VPN и доп. сети):")
        for extra in extras:
            log(f"  http://{extra}:{port}/")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Развернуть Furniture в локальной сети и выдать рабочую ссылку.",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8080,
        help="Предпочитаемый порт витрины (по умолчанию 8080).",
    )
    parser.add_argument(
        "--no-build",
        action="store_true",
        help="Не пересобирать образы, только поднять контейнеры.",
    )
    parser.add_argument(
        "--print-only",
        action="store_true",
        help="Не трогать Docker, только напечатать ссылку на уже запущенный стенд.",
    )
    return parser.parse_args()


def current_gateway_port(compose: list[str], env: dict[str, str]) -> int:
    result = run_docker(compose, ["port", "gateway-service", "8000"], env=env)
    if result.returncode == 0:
        # 0.0.0.0:8080 or [::]:8080
        text = result.stdout.strip().splitlines()[-1] if result.stdout.strip() else ""
        if ":" in text:
            try:
                return int(text.rsplit(":", 1)[1])
            except ValueError:
                pass
    return int(env.get("GATEWAY_HOST_PORT", "8080"))


def main() -> None:
    configure_stdio()
    args = parse_args()
    compose = docker_cmd()
    env = allocate_ports(compose, args.port)

    if not args.print_only:
        log("== Furniture: развёртывание в локальной сети ==")
        log(f"Каталог: {ROOT}")
        cmd = ["up", "-d", "--remove-orphans"]
        if not args.no_build:
            cmd.insert(1, "--build")
            log("[1/3] Сборка и запуск Docker...")
        else:
            log("[1/3] Запуск Docker без пересборки...")
        log(
            "Порты: "
            + ", ".join(f"{name}={value}" for name, value in env.items())
        )
        recreate = run_docker(
            compose,
            ["up", "-d", "--no-deps", "--force-recreate", "postgres"],
            env=env,
        )
        if recreate.returncode != 0:
            details = (recreate.stderr or recreate.stdout).strip()
            fail(details or "не удалось пересоздать postgres")
        result = run_docker(compose, cmd, env=env)
        if result.returncode != 0:
            details = (result.stderr or result.stdout).strip()
            fail(details or "docker compose up завершился с ошибкой")
        log("[2/3] Жду готовности gateway...")
        gateway_port = current_gateway_port(compose, env)
        if not wait_health(gateway_port):
            logs = run_docker(compose, ["logs", "--tail", "80", "gateway-service"], env=env)
            log(logs.stdout or logs.stderr)
            fail("Gateway не ответил за 90 секунд. Смотрите: docker compose logs gateway-service")
        log("[3/3] Открываю порт для других устройств...")
        log(try_open_firewall(gateway_port))
    else:
        gateway_port = current_gateway_port(compose, env)
        if not http_ok(f"http://127.0.0.1:{gateway_port}/health"):
            fail("Стенд не запущен. Запустите без --print-only.")

    lan_ip, extras = choose_lan_ip()
    lan_health = f"http://{lan_ip}:{gateway_port}/health"
    if lan_ip != "127.0.0.1" and not http_ok(lan_health):
        log(f"Предупреждение: {lan_health} пока не открывается с этого ПК.")
        log("Ссылка ниже всё равно должна работать с телефона в той же сети, если брандмауэр не блокирует порт.")

    print_links(lan_ip, gateway_port, extras)


if __name__ == "__main__":
    main()
