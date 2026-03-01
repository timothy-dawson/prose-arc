"""
Object storage abstraction.

Provides a unified interface for uploading, downloading, and generating
signed URLs — backed by MinIO (local dev) or Google Cloud Storage (prod).

The active backend is selected by the STORAGE_BACKEND env var.

Usage:
    from app.core.storage import get_storage

    storage = get_storage()
    await storage.upload("covers/book-123.jpg", image_bytes, "image/jpeg")
    url = await storage.signed_url("covers/book-123.jpg", expires=3600)
"""

from abc import ABC, abstractmethod

import boto3
from botocore.client import Config

from app.core.config import get_settings


class StorageBackend(ABC):
    @abstractmethod
    async def upload(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> None:
        """Upload bytes to the given key (path within the bucket)."""
        ...

    @abstractmethod
    async def download(self, key: str) -> bytes:
        """Download and return the bytes stored at key."""
        ...

    @abstractmethod
    async def signed_url(self, key: str, expires: int = 3600) -> str:
        """Return a pre-signed URL granting temporary GET access to key."""
        ...

    @abstractmethod
    async def delete(self, key: str) -> None:
        """Delete the object at key."""
        ...


class MinIOBackend(StorageBackend):
    """S3-compatible backend using boto3 (works with MinIO and AWS S3)."""

    def __init__(self) -> None:
        settings = get_settings()
        self._bucket = settings.minio_bucket
        scheme = "https" if settings.minio_use_ssl else "http"
        self._client = boto3.client(
            "s3",
            endpoint_url=f"{scheme}://{settings.minio_endpoint}",
            aws_access_key_id=settings.minio_access_key,
            aws_secret_access_key=settings.minio_secret_key,
            config=Config(signature_version="s3v4"),
            region_name="us-east-1",  # MinIO ignores this but boto3 requires it
        )

    async def upload(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> None:
        self._client.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )

    async def download(self, key: str) -> bytes:
        response = self._client.get_object(Bucket=self._bucket, Key=key)
        return response["Body"].read()  # type: ignore[no-any-return]

    async def signed_url(self, key: str, expires: int = 3600) -> str:
        return self._client.generate_presigned_url(  # type: ignore[no-any-return]
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=expires,
        )

    async def delete(self, key: str) -> None:
        self._client.delete_object(Bucket=self._bucket, Key=key)


class GCSBackend(StorageBackend):
    """Google Cloud Storage backend (production)."""

    def __init__(self) -> None:
        # Lazy import — gcs deps only needed in production
        from google.cloud import storage as gcs  # type: ignore[import-untyped]

        settings = get_settings()
        self._bucket_name = settings.gcs_bucket
        if settings.gcs_credentials_path:
            self._client = gcs.Client.from_service_account_json(settings.gcs_credentials_path)
        else:
            self._client = gcs.Client()  # uses ADC
        self._bucket = self._client.bucket(self._bucket_name)

    async def upload(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> None:
        blob = self._bucket.blob(key)
        blob.upload_from_string(data, content_type=content_type)

    async def download(self, key: str) -> bytes:
        blob = self._bucket.blob(key)
        return blob.download_as_bytes()  # type: ignore[no-any-return]

    async def signed_url(self, key: str, expires: int = 3600) -> str:
        import datetime

        blob = self._bucket.blob(key)
        return blob.generate_signed_url(  # type: ignore[no-any-return]
            expiration=datetime.timedelta(seconds=expires),
            method="GET",
        )

    async def delete(self, key: str) -> None:
        blob = self._bucket.blob(key)
        blob.delete()


def get_storage() -> StorageBackend:
    """Factory — returns the configured storage backend."""
    settings = get_settings()
    if settings.storage_backend == "gcs":
        return GCSBackend()
    return MinIOBackend()
