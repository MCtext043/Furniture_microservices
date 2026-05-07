"""HTTP API Gateway: unified entrypoint with path prefix routing."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
import httpx
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware


def _env_url(name: str, default: str) -> str:
    return os.getenv(name, default)


@asynccontextmanager
async def lifespan(app: FastAPI):
    timeout = httpx.Timeout(600.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        app.state.http = client
        yield


METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]

app = FastAPI(
    title="Furniture API Gateway",
    description=(
        "Единый вход с префиксами `/catalog`, `/cutting`, `/planner`, `/auth`, `/assets`."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BACKENDS = {
    "catalog": _env_url("GATEWAY_CATALOG_URL", "http://localhost:8001"),
    "cutting": _env_url("GATEWAY_CUTTING_URL", "http://localhost:8002"),
    "planner": _env_url("GATEWAY_PLANNER_URL", "http://localhost:8003"),
    "auth": _env_url("GATEWAY_AUTH_URL", "http://localhost:8004"),
    "assets": _env_url("GATEWAY_ASSETS_URL", "http://localhost:8005"),
}


async def _forward(request: Request, base_url: str, path: str) -> Response:
    target = f"{base_url.rstrip('/')}/{path}" if path else base_url.rstrip("/")
    body = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() != "host"}
    try:
        resp = await request.app.state.http.request(
            request.method,
            target,
            content=body if body else None,
            headers=headers,
            params=request.query_params.multi_items(),
        )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Upstream error: {exc}") from exc
    content_type = resp.headers.get("content-type")
    skip = {"content-encoding", "transfer-encoding", "connection"}
    hdrs = [(k, v) for k, v in resp.headers.items() if k.lower() not in skip]
    return Response(content=resp.content, status_code=resp.status_code, headers=dict(hdrs), media_type=content_type)


@app.get("/health")
async def gw_health():
    return {"status": "ok", "role": "gateway"}


def _register_proxy(prefix: str, base_url: str) -> None:
    async def bare(request: Request) -> Response:
        return await _forward(request, base_url, "")

    async def nested(path: str, request: Request) -> Response:
        return await _forward(request, base_url, path)

    app.add_api_route(f"/{prefix}", bare, methods=METHODS)
    app.add_api_route(f"/{prefix}/{{path:path}}", nested, methods=METHODS)


for segment, target in BACKENDS.items():
    _register_proxy(segment, target)
