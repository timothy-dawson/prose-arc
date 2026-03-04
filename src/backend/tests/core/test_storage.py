"""
Integration tests for the GCS storage backend (fake-gcs-server in dev).

Marked with @pytest.mark.integration — skipped in CI unless services are available.
Run locally with: pytest -m integration
"""

import pytest

from app.core.storage import GCSBackend


@pytest.mark.integration
async def test_upload_download_round_trip() -> None:
    storage = GCSBackend()
    key = "test/round-trip.txt"
    data = b"Hello from Prose Arc storage test"

    await storage.upload(key, data, content_type="text/plain")
    downloaded = await storage.download(key)
    await storage.delete(key)

    assert downloaded == data


@pytest.mark.integration
async def test_signed_url_is_string() -> None:
    storage = GCSBackend()
    key = "test/signed-url.txt"
    data = b"signed url test content"

    await storage.upload(key, data)
    url = await storage.signed_url(key, expires=60)
    await storage.delete(key)

    assert isinstance(url, str)
    assert "http" in url
    import urllib.parse
    assert urllib.parse.quote(key, safe="") in url or key in url
