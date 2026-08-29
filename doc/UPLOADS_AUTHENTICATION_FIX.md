# Fix Report — Issue A6: `/uploads` Served Publicly Without Authentication

**Date:** 2026-08-27 · **Status:** ✅ Fixed & fully tested (385/385 suite green + live server verification)
**Related audit:** [`LAUNCH_AUDIT_REPORT.md`](../LAUNCH_AUDIT_REPORT.md) §2 (issue A6)

---

## 1. The problem

`backend/app/main.py` mounted the uploads directory as a public static site:

```python
app.mount("/uploads", StaticFiles(directory=uploads_directory), name="uploads")
```

Everything written there was downloadable by **anyone on the internet with no authentication**:

- **Online-class materials & recordings** — `uploads/online-classes/{class_uuid}/{uuid}_{name}`
- **Notice attachments** — `uploads/notices/{notice_uuid}/{uuid}{ext}`

The path components are UUIDs (hard to guess), but URLs are routinely exposed in browser history, support tickets, screenshots, referer headers and proxies — a leaked link leaked the file **forever**. For an education ERP holding exam recordings and institutional notices, that is an unacceptable data-exposure class.

## 2. Design decision: signed, expiring URLs

The clients render these files in `<img src>`, `<video src>` and `<a href>` (web: `components/principal/notices.tsx`, `components/shared/live-room-ui.tsx`; mobile: `app/src/app/(student)/online-classes/[id].tsx` via `fileHref()`). **Those browser requests cannot carry an `Authorization` header**, so a plain "require bearer token" endpoint would have broken every image/video with blob-fetch plumbing on two clients.

The standard production answer — and the one implemented — is **short-lived signed URLs**:

```
API response embeds:  /api/v1/files/signed/{JWT}
JWT payload:          { sub: "/uploads/notices/{id}/{file}", type: "file", exp: now + 120 min }
```

- The **authorization decision happens where it belongs**: when a notice/class payload is built. Only users who passed the existing tenant/enrollment/role checks receive URLs for that resource's files.
- The file endpoint is **stateless** (pure crypto + filesystem): no DB round-trip, scales horizontally, works with any CDN in front.
- A leaked link **expires** (`FILE_URL_TTL_MINUTES`, default 120 min) instead of leaking forever.
- Tokens are signed with the same `JWT_SECRET_KEY`; `type: "file"` means **login JWTs can never be used as file tokens** and vice-versa.
- **Zero client changes**: web/mobile helpers (`attachmentUrl`, `fileHref`) only check `url.startsWith("/")` and prepend the API base — signed URLs pass through unchanged.

## 3. The fix

### 3.1 Public mount removed — `backend/app/main.py`
The `StaticFiles` mount is deleted. The uploads directory is still created (writers need it) with a comment forbidding re-mounting.

### 3.2 New `backend/app/routers/files.py`
One endpoint: `GET /api/v1/files/signed/{token}`

| Check (in order) | Failure response |
|---|---|
| Signature invalid / tampered | **403** |
| Token expired | **410 Gone** (clients re-fetch the list for fresh URLs) |
| `type != "file"` (e.g. a login JWT) | **403** |
| Path contains `..` segments | **403** (logged) |
| Resolved path escapes `uploads/` root | **403** (logged) |
| File missing | **404** |

Successful responses stream via `FileResponse` with hardened headers:

- `Content-Disposition: attachment` — an uploaded SVG/HTML can never execute as a document on this origin (stored-XSS defence); `<img>/<video>` rendering is unaffected.
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer` — signed URLs don't leak into Referer headers.
- `Cache-Control: private, max-age=300` — never cached in shared proxies/CDNs.
- **HTTP Range supported** (206 Partial Content) — video players can seek recordings.

### 3.3 Token machinery — `backend/app/services/jwt_service.py`
Added next to the other token functions (the single crypto home — no duplicated signing code):
`create_file_token(path, ttl)` and `sign_upload_url(path)`; decoding reuses the existing `decode_access_token`.

### 3.4 URL emission switched to signed URLs
| Location | Before | After |
|---|---|---|
| `online_class_service._file_rows` (materials/recordings list) | raw `/uploads/...` | `sign_upload_url(...)` |
| `online_class_service` recording emissions (3 sites) | raw DB value | `_signed_file_url()` helper — signs `/uploads/...`, passes external URLs through |
| `principal_service` notice attachments (save + read) | raw `file_key` | `sign_upload_url(file_key)`; external links untouched |

All other role consoles (VP/HOD/coordinator/teacher/student) reuse these builders — one change covers every surface.

**Recording storage corrected:** `save_recording` previously persisted the response URL into the DB. It now persists the uploads-relative **path**; URLs are re-signed on every read. (A persisted signed URL would silently die at expiry.)

### 3.5 Repo hygiene
`backend/.gitignore` now excludes `uploads/` — user content must never be committed.

## 4. Files changed

| File | Change |
|---|---|
| `backend/app/routers/files.py` | **New** — signed download endpoint with full security checks |
| `backend/app/main.py` | Public `/uploads` mount **removed**; `files_router` registered |
| `backend/app/routers/__init__.py` | `files_router` export |
| `backend/app/services/jwt_service.py` | `create_file_token` / `sign_upload_url` |
| `backend/app/config.py` + `.env.example` | `FILE_URL_TTL_MINUTES` (default 120) |
| `backend/app/services/online_class_service.py` | Signed file/recording URLs; recordings persist paths, not URLs |
| `backend/app/services/principal_service.py` | Signed attachment URLs |
| `backend/.gitignore` | `uploads/` excluded |
| `backend/tests/test_files.py` | **New** — 11 tests pinning the security boundary |

**Database:** no schema or data changes were required — file metadata already stores paths/keys, and signing is applied at response time. No SQL update file needed.
**Frontend/mobile:** zero changes required — relative-URL helpers handle the new URL shape transparently.

## 5. Verification

### 5.1 Automated tests — `tests/test_files.py` (11 tests, all passing)
- Raw `/uploads/...` path is **no longer routable** (404).
- Signed URL streams exact bytes with `nosniff`, `attachment`, private-cache headers.
- **Range requests → 206** (video seeking).
- Tampered token → 403 · expired token → 410 · login JWT as file token → 403.
- Traversal (`../.env`, `../../backend/.env`, signed evil paths) → 403.
- Missing file → 404 (not 500).
- Signing policy: only `/uploads/` paths get signed; external links pass through.

```
385 passed, 9 warnings in 19.82s     ← full backend suite
```

### 5.2 Live server verification (real uvicorn process, curl)
```
=== 1. OLD PUBLIC PATH (must be blocked now) ===
GET /uploads/live-demo/secret-class/answers.pdf -> 404        ← was 200 before the fix
=== 2. SIGNED URL (authorized) ===
HTTP/1.1 200 OK
x-content-type-options: nosniff
cache-control: private, max-age=300
content-type: application/pdf
content-disposition: attachment; filename="answers.pdf"
body: CONFIDENTIAL: exam answers
=== 3. TAMPERED TOKEN ===
-> 403
=== 4. RANGE (video seeking) ===
HTTP/1.1 206 Partial Content
content-range: bytes 0-11/27
=== 5. Health still OK ===
{"status":"healthy","environment":"production"}
```

## 6. Operations notes

- **TTL tuning:** set `FILE_URL_TTL_MINUTES` higher if pages stay open for hours without refresh (each list reload mints fresh URLs anyway).
- **Access logs:** signed tokens appear in URL access logs by their nature; the short TTL bounds exposure. Keep logs access-restricted.
- **Object storage migration path:** when uploads move to S3-compatible storage, only `_resolve_upload_path`/`FileResponse` in `files.py` and the writers change — every client keeps consuming the same `/api/v1/files/signed/{token}` contract.
- **Legacy data:** recordings saved before this fix may hold previously-generated URLs; re-saving a recording (or backfilling the column with `/uploads/online-classes/{class_id}/{stored_name}`) restores them.
