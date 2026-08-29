"""
Tests for authenticated file delivery (audit issue A6).

The old behaviour mounted backend/uploads publicly (StaticFiles) — anyone who
guessed /uploads/online-classes/{uuid}/... could download classroom
materials, recordings and notice attachments. These tests pin the new
security boundary:

  * the /uploads path is no longer publicly routable
  * files are only reachable through /api/v1/files/signed/{token}
  * tokens are type-bound ("file"), signature-checked, expiry-checked
  * traversal out of the uploads root is refused
  * responses carry no-sniff / attachment / private-cache headers
  * Range requests work (video seeking in <video> players)
"""

from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException

from app.routers.files import UPLOAD_ROOT, _resolve_upload_path
from app.services.jwt_service import (
    create_file_token,
    create_platform_access_token,
    sign_upload_url,
)

# ── Fixture: a real file inside the uploads root ──────────────────────────────

SAMPLE_BYTES = b"ERP test payload 0123456789" * 64  # 1.7 KB, range-testable


@pytest.fixture()
def sample_file():
    """Create a temp file under uploads/ and remove it after the test."""
    rel_dir = f"test-tmp/{uuid.uuid4().hex}"
    directory = UPLOAD_ROOT / rel_dir
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / "notes.pdf"
    path.write_bytes(SAMPLE_BYTES)
    yield f"/uploads/{rel_dir}/notes.pdf"
    path.unlink(missing_ok=True)
    directory.rmdir()


# ── 1. Public mount is gone ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_raw_uploads_path_is_no_longer_public(client, sample_file):
    """Direct /uploads/... access must NOT serve the file anymore."""
    res = await client.get(sample_file)
    assert res.status_code == 404


# ── 2. Signed endpoint serves authorized downloads ────────────────────────────


@pytest.mark.asyncio
async def test_signed_url_streams_the_file_with_secure_headers(client, sample_file):
    token = create_file_token(sample_file)
    res = await client.get(f"/api/v1/files/signed/{token}")
    assert res.status_code == 200, res.text
    assert res.content == SAMPLE_BYTES
    assert res.headers["content-type"].startswith("application/pdf")
    assert res.headers["x-content-type-options"] == "nosniff"
    assert "attachment" in res.headers.get("content-disposition", "")
    assert res.headers["cache-control"].startswith("private")


@pytest.mark.asyncio
async def test_range_requests_work_for_video_seeking(client, sample_file):
    token = create_file_token(sample_file)
    res = await client.get(
        f"/api/v1/files/signed/{token}", headers={"Range": "bytes=0-9"}
    )
    assert res.status_code == 206, res.text
    assert res.content == SAMPLE_BYTES[0:10]


@pytest.mark.asyncio
async def test_sign_upload_url_roundtrip(client, sample_file):
    """The exact URL shape embedded in API responses is downloadable."""
    url = sign_upload_url(sample_file)
    assert url.startswith("/api/v1/files/signed/")
    res = await client.get(url)
    assert res.status_code == 200
    assert res.content == SAMPLE_BYTES


# ── 3. Token security ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_tampered_token_is_rejected(client, sample_file):
    token = create_file_token(sample_file)
    tampered = token[:-2] + ("aa" if token[-2:] != "aa" else "bb")
    res = await client.get(f"/api/v1/files/signed/{tampered}")
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_expired_token_returns_410(client, sample_file):
    token = create_file_token(sample_file, ttl_minutes=-1)
    res = await client.get(f"/api/v1/files/signed/{token}")
    assert res.status_code == 410


@pytest.mark.asyncio
async def test_login_tokens_cannot_be_used_as_file_tokens(client, sample_file):
    """A platform/owner/tenant JWT must never unlock a file download."""
    login_token = create_platform_access_token(uuid.uuid4(), role="SUPER_ADMIN")
    res = await client.get(f"/api/v1/files/signed/{login_token}")
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_missing_file_is_404_not_500(client):
    token = create_file_token("/uploads/test-tmp/never-existed.bin")
    res = await client.get(f"/api/v1/files/signed/{token}")
    assert res.status_code == 404


# ── 4. Path traversal defence ─────────────────────────────────────────────────


def test_traversal_outside_the_uploads_root_is_refused(sample_file):
    for evil in ("../.env", "/uploads/../.env", "../../backend/.env"):
        with pytest.raises(HTTPException) as raised:
            _resolve_upload_path(evil)
        assert raised.value.status_code == 403


@pytest.mark.asyncio
async def test_signed_traversal_token_still_refused(client):
    """Even a correctly signed evil path must not escape the root."""
    token = create_file_token("/uploads/../../backend/.env")
    res = await client.get(f"/api/v1/files/signed/{token}")
    assert res.status_code in (403, 404)
    assert res.status_code != 200


# ── 5. URL signing policy in services ─────────────────────────────────────────


def test_only_upload_paths_get_signed():
    """External links and None pass through untouched; uploads get signed."""
    from app.services.online_class_service import _signed_file_url

    assert _signed_file_url(None) is None
    assert _signed_file_url("https://cdn.example.com/rec.mp4") == "https://cdn.example.com/rec.mp4"
    signed = _signed_file_url("/uploads/online-classes/abc/rec.mp4")
    assert signed.startswith("/api/v1/files/signed/")
