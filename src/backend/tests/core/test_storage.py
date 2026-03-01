"""
Integration tests for the MinIO storage backend.

Marked with @pytest.mark.integration — skipped in CI unless services are available.
Run locally with: pytest -m integration
"""

import pytest

from app.core.storage import MinIOBackend


@pytest.mark.integration
async def test_upload_download_round_trip() -> None:
    storage = MinIOBackend()
    key = "test/round-trip.txt"
    data = b"Hello from Prose Arc storage test"

    await storage.upload(key, data, content_type="text/plain")
    downloaded = await storage.download(key)
    await storage.delete(key)

    assert downloaded == data


@pytest.mark.integration
async def test_signed_url_is_string() -> None:
    storage = MinIOBackend()
    key = "test/signed-url.txt"
    data = b"signed url test content"

    await storage.upload(key, data)
    url = await storage.signed_url(key, expires=60)
    await storage.delete(key)

    assert isinstance(url, str)
    assert "http" in url
    assert key in url
