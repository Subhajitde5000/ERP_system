"""
Routers — Authenticated delivery of uploaded files (audit issue A6)

Before this router, ``main.py`` mounted the uploads directory publicly:

    app.mount("/uploads", StaticFiles(directory=uploads))

so anyone who knew or guessed ``/uploads/online-classes/{uuid}/…`` or
``/uploads/notices/{uuid}/…`` could download classroom materials,
recordings and notice attachments with **no authentication at all**.

The replacement is a signed-URL scheme (works with <img>/<video>/<a> tags,
which cannot send Authorization headers):

  1. When an authorized user receives a notice/class payload, the API signs
     each file path into ``/api/v1/files/signed/{token}`` (see
     ``jwt_service.sign_upload_url``). Only users allowed to see the
     resource ever receive a URL for it.
  2. ``GET /api/v1/files/signed/{token}`` re-verifies the signature, the
     ``type="file"`` claim, the expiry, and that the resolved path stays
     inside the uploads root before streaming the bytes.

Security properties enforced on every request:
  * invalid / tampered token            → 403
  * valid token but expired             → 410 (client can re-fetch the list)
  * token of another type (login JWTs)  → 403
  * path escaping the uploads root      → 403 (defence in depth)
  * missing file                        → 404
  * ``Content-Disposition: attachment`` + ``X-Content-Type-Options: nosniff``
    so an uploaded SVG/HTML can never execute as a document in this origin,
    while <img>/<video> elements still render it normally.

No database access here by design: verification is pure crypto + filesystem,
so the endpoint stays fast and scales horizontally without connection pools.
"""

import logging
import mimetypes
from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse
from jose import ExpiredSignatureError, JWTError

from app.services.jwt_service import decode_access_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/files", tags=["Files"])

# Uploads live in backend/uploads (same root main.py creates for writers).
UPLOAD_ROOT = (Path(__file__).resolve().parents[2] / "uploads").resolve()


def _resolve_upload_path(relative_path: str) -> Path:
    """
    Map a signed uploads-root-relative path to an absolute file path,
    refusing anything that escapes the uploads root (traversal defence).
    Raises 403 on escape attempts, 404 when the file does not exist.
    """
    # Strict rule: reject any '..' segment before touching the filesystem.
    if ".." in Path(relative_path).parts:
        logger.warning("Signed-file path traversal attempt: %r", relative_path)
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Invalid file path")
    # Claims keep the legacy "/uploads/..." shape (same as stored file_keys);
    # UPLOAD_ROOT is already that directory, so drop the prefix before joining.
    relative = relative_path.lstrip("/")
    if relative.startswith("uploads/"):
        relative = relative[len("uploads/"):]
    candidate = (UPLOAD_ROOT / relative).resolve()
    if candidate != UPLOAD_ROOT and UPLOAD_ROOT not in candidate.parents:
        logger.warning("Signed-file path escape attempt: %r", relative_path)
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Invalid file path")
    if not candidate.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="File not found")
    return candidate


@router.get("/signed/{token}")
async def download_signed_file(token: str) -> FileResponse:
    """
    Stream one uploaded file behind a short-lived signed token.

    The token is a JWT with ``type="file"`` and the uploads-relative path in
    ``sub``; it is single-purpose and expires (FILE_URL_TTL_MINUTES), so a
    leaked link stops working instead of leaking forever.
    """
    try:
        payload = decode_access_token(token)
    except ExpiredSignatureError:
        # 410 tells clients the link itself is stale — re-fetch the list to
        # obtain fresh signed URLs.
        raise HTTPException(status.HTTP_410_GONE, detail="Download link expired")
    except JWTError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Invalid download link")

    # Login tokens (platform/owner/tenant) must never double as file tokens.
    if payload.get("type") != "file" or not payload.get("sub"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Invalid download link")

    file_path = _resolve_upload_path(str(payload["sub"]))

    media_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
    return FileResponse(
        path=file_path,
        media_type=media_type,
        # 'attachment' stops browsers executing SVG/HTML on direct navigation;
        # <img>/<video> embedding is unaffected.
        filename=file_path.name,
        headers={
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
            # URLs are single-use-ish and expiring — never cache in shared CDNs.
            "Cache-Control": "private, max-age=300",
        },
    )
