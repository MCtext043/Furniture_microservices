"""S3-compatible object storage (MinIO) presigned URLs for 3D models and images."""

from __future__ import annotations

import os
from functools import lru_cache

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

from common.jwt_auth import ensure_assets_writer

BUCKET = os.getenv("S3_BUCKET", "furniture-assets")
CDN_BASE_URL = os.getenv("CDN_PUBLIC_BASE_URL", "").rstrip("/")


@lru_cache
def _client():
    endpoint = os.getenv("S3_ENDPOINT_URL", "http://localhost:9000")
    ak = os.getenv("S3_ACCESS_KEY", "minioadmin")
    sk = os.getenv("S3_SECRET_KEY", "minioadmin")
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=ak,
        aws_secret_access_key=sk,
        region_name=os.getenv("AWS_REGION", "us-east-1"),
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


class PresignPutRequest(BaseModel):
    object_key: str = Field(description="Key inside bucket, e.g. models/chair.glb")
    content_type: str = Field(default="application/octet-stream")
    expires_seconds: int = Field(default=3600, ge=60, le=86400)


class PresignPutResponse(BaseModel):
    upload_url: str
    bucket: str
    object_key: str
    expires_seconds: int
    cdn_hint: str | None = Field(
        default=None,
        description="Public CDN base for GET after upload, if configured.",
    )


class PresignGetRequest(BaseModel):
    object_key: str
    expires_seconds: int = Field(default=3600, ge=60, le=86400)


class PresignGetResponse(BaseModel):
    download_url: str
    cdn_url: str | None = None


app = FastAPI(
    title="Furniture Assets Service",
    description=(
        "Presigned PUT/GET for MinIO (S3 API). "
        "Point CDN_PUBLIC_BASE_URL at your CDN origin for stable public URLs."
    ),
    version="0.1.0",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/presign-put", response_model=PresignPutResponse, dependencies=[Depends(ensure_assets_writer)])
def presign_put(payload: PresignPutRequest) -> PresignPutResponse:
    cli = _client()
    try:
        url = cli.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": BUCKET,
                "Key": payload.object_key,
                "ContentType": payload.content_type,
            },
            ExpiresIn=payload.expires_seconds,
        )
    except ClientError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    cdn = f"{CDN_BASE_URL}/{payload.object_key}" if CDN_BASE_URL else None
    return PresignPutResponse(
        upload_url=url,
        bucket=BUCKET,
        object_key=payload.object_key,
        expires_seconds=payload.expires_seconds,
        cdn_hint=cdn,
    )


@app.post("/presign-get", response_model=PresignGetResponse)
def presign_get(payload: PresignGetRequest) -> PresignGetResponse:
    cli = _client()
    try:
        url = cli.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": BUCKET, "Key": payload.object_key},
            ExpiresIn=payload.expires_seconds,
        )
    except ClientError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    cdn = f"{CDN_BASE_URL}/{payload.object_key}" if CDN_BASE_URL else None
    return PresignGetResponse(download_url=url, cdn_url=cdn)
