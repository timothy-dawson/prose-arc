"""
Object storage abstraction backed by Google Cloud Storage.

For local development, point STORAGE_EMULATOR_HOST at a fake-gcs-server
instance (e.g. http://fake-gcs:4443) and set GCS_PUBLIC_HOST to the
browser-accessible base URL (e.g. http://localhost:4000).  The Python GCS
client library automatically routes requests to the emulator when
STORAGE_EMULATOR_HOST is set in the environment.

Usage:
    from app.core.storage import get_storage

    storage = get_storage()
    await storage.upload("covers/book-123.jpg", image_bytes, "image/jpeg")
    url = await storage.signed_url("covers/book-123.jpg", expires=3600)
"""

import urllib.parse
from abc import ABC, abstractmethod

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
        """Return a URL granting GET access to key.

        In emulator mode returns a direct (permanent) download URL.
        In production returns a signed URL with the given expiry in seconds.
        """
        ...

    @abstractmethod
    async def delete(self, key: str) -> None:
        """Delete the object at key."""
        ...


class GCSBackend(StorageBackend):
    """Google Cloud Storage backend.

    Local dev: set STORAGE_EMULATOR_HOST=http://fake-gcs:4443 so the GCS
    client library routes to the fake-gcs-server emulator, and set
    GCS_PUBLIC_HOST=http://localhost:4000 so generated object URLs are
    reachable from the browser.

    Production: uses ADC (Application Default Credentials) or a service
    account JSON file (GCS_CREDENTIALS_PATH).
    """

    def __init__(self) -> None:
        from google.cloud import storage as gcs  # type: ignore[import-untyped]

        settings = get_settings()
        self._bucket_name = settings.gcs_bucket
        self._emulator = bool(settings.storage_emulator_host)
        # Public host used to build browser-accessible download URLs in dev
        self._public_host = (settings.gcs_public_host or settings.storage_emulator_host).rstrip("/")

        if self._emulator:
            # AnonymousCredentials — emulator doesn't require auth.
            # The GCS library reads STORAGE_EMULATOR_HOST from the environment
            # and routes all API calls to fake-gcs-server automatically.
            from google.auth.credentials import AnonymousCredentials  # type: ignore[import-untyped]

            self._client = gcs.Client(
                project="prose-arc-dev",
                credentials=AnonymousCredentials(),  # type: ignore[arg-type]
            )
        elif settings.gcs_credentials_path:
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
        if self._emulator:
            # Direct download URL — no expiry, reachable from the browser via
            # the GCS_PUBLIC_HOST (fake-gcs -public-host flag).
            encoded = urllib.parse.quote(key, safe="")
            return f"{self._public_host}/download/storage/v1/b/{self._bucket_name}/o/{encoded}?alt=media"

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
    """Factory — returns the configured GCS storage backend."""
    return GCSBackend()
