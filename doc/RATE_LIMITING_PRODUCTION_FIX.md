# Fix Report — Issue A4: Rate Limiting in Production Topology

**Date:** 2026-08-27 · **Status:** ✅ Fixed & fully tested (374/374 suite green + live Redis verification)
**Related audit:** [`LAUNCH_AUDIT_REPORT.md`](../LAUNCH_AUDIT_REPORT.md) §2 (issue A4)

---

## 1. The problem

Rate limiting existed but was **silently broken in any production deployment** for two independent reasons:

### 1.1 In-memory storage instead of Redis
`slowapi`'s `Limiter` was created without `storage_uri`, so every counter lived in one worker's RAM:

- With `uvicorn --workers 4` (or gunicorn), each worker kept its **own** counters → the real limit was `N workers × configured limit` (login "10/minute" was actually 40/minute).
- Every deploy/restart reset all counters to zero.
- `REDIS_URL` was already configured and required — it just was never wired in.

### 1.2 Wrong client key behind a reverse proxy
Every limiter used `slowapi.util.get_remote_address`, which returns the **TCP peer**. Behind nginx / an ALB the peer is the load balancer itself, so:

- All users of a school shared **one** bucket → legitimate users got locked out of login ("10/minute" per *institution*).
- The deployment also blindly trusted no headers, so operators had no way to fix the keying without code changes.

### 1.3 Seven duplicated limiters
The same `limiter = Limiter(key_func=get_remote_address)` was copy-pasted in **7 modules** (`main.py` + 6 routers), each with its own isolated in-memory store — so even limits within one worker didn't share state across routers.

## 2. The fix

### 2.1 New single source of truth — `backend/app/rate_limit.py`
One module now owns rate limiting; the 7 duplicated definitions were **deleted** (no duplicate code left — verified by grep):

```python
from app.rate_limit import limiter   # used by main.py and every router
```

The shared limiter:

```python
limiter = Limiter(
    key_func=client_ip,                          # proxy-aware, spoof-resistant
    storage_uri=resolve_storage_uri(settings.REDIS_URL),  # Redis, verified
)
```

### 2.2 Redis-backed counters with safe degradation — `resolve_storage_uri()`
At startup the Redis connection is **verified with a real ping** before wiring it in:

- Redis reachable → all workers share one counter store (verified live, §4).
- Redis unreachable/broken → **falls back to in-memory** with a loud `WARNING` log explaining the degraded mode, instead of 500-ing on every request.

A rate limiter must never take the API down — degraded-and-loud beats broken-and-silent.

### 2.3 Spoof-resistant client IP — `client_ip()`
Implements the standard **rightmost-untrusted** rule:

| Situation | Bucket key |
|---|---|
| No `X-Forwarded-For` | TCP peer |
| Header from a **non-trusted** peer (public internet) | TCP peer — header **ignored** (forgery-proof) |
| Header from a **trusted** proxy | first non-trusted hop walking the chain right→left |
| Whole chain is trusted proxies | leftmost hop |
| Malformed IPs in the chain | treated as untrusted (never a crash) |

**Trusted by default** (no config needed): loopback, RFC1918 private space, link-local, and their IPv6 equivalents — a public attacker cannot originate from these ranges, and this covers docker/sidecar/k8s meshes automatically.

**New config** (`Settings.TRUSTED_PROXIES`, see `.env.example`): comma-separated extra CIDRs for load balancers with public IPs, e.g. `TRUSTED_PROXIES=203.0.113.64/26`. Invalid entries are logged and skipped.

### 2.4 Standard 429 response
`main.py` now returns 429 in the API's `ErrorDetail` envelope (previously slowapi's bare text handler), with a `Retry-After: 60` header:

```json
{
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests — please slow down and retry shortly.",
  "details": "Rate limit exceeded: 3 per 1 minute"
}
```

### 2.5 Bonus bug found & fixed while testing
`OnlineClassService.list_for_student` compared the class's **UTC** date with the tenant's **local** date to split "today" vs "upcoming" — a class at 18:51 UTC is tomorrow for an Asia/Kolkata institution but was bucketed as "today", and the integration test only passed during a ~5-hour daily window. Fixed by converting `scheduled_at` into the tenant timezone before the date comparison, and the test now schedules 25h ahead (always "tomorrow" in any timezone) — deterministic at any hour.

## 3. Files changed

| File | Change |
|---|---|
| `backend/app/rate_limit.py` | **New** — shared limiter, `client_ip`, `resolve_storage_uri`, trusted-proxy logic (fully documented) |
| `backend/app/config.py` | New `TRUSTED_PROXIES` setting |
| `backend/app/main.py` | Uses shared limiter; JSON 429 handler with `ErrorDetail` envelope; removed duplicate limiter + stale comment |
| `backend/app/routers/owner/auth.py`, `owner/dashboard.py`, `platform/auth.py`, `public/signup.py`, `service_requests.py`, `tenant/auth.py` | Removed 6 duplicate `Limiter(...)` constructions → import the shared one |
| `backend/.env.example` | Documented `REDIS_URL` role + new `TRUSTED_PROXIES` |
| `backend/app/services/online_class_service.py` | Timezone-correct today/upcoming bucketing |
| `backend/tests/test_rate_limit.py` | **New** — 17 tests (key function, storage resolution, e2e 429 + spoofing) |
| `backend/tests/test_online_class_integration.py` | Deterministic scheduling (25h ahead) |

**Database:** no schema or data changes were required — rate-limit state lives in Redis, not PostgreSQL. No SQL update file needed.

## 4. Verification

### 4.1 Automated tests — `tests/test_rate_limit.py` (17 tests, all passing)
- **Key function:** direct connection, missing client, spoofed header from untrusted peer ignored, trusted proxy → rightmost untrusted hop, multi-hop chains, all-proxy chains, malformed entries, IPv6, `TRUSTED_PROXIES` honoured/garbage skipped.
- **Storage resolution:** blank/memory URI, unreachable Redis → memory fallback, reachable Redis selected (monkeypatched ping), failing ping → fallback.
- **End-to-end:** 3 requests OK → 4th is 429 with the exact JSON envelope + `Retry-After`; spoofed `X-Forwarded-For` cannot reset a bucket; a genuine proxy gets independent per-client buckets.

```
374 passed, 9 warnings in 19.65s     ← full backend suite
```

### 4.2 Live Redis verification (embedded real Redis via redislite)
Run against an actual Redis server, not mocks:

```
[1] Real Redis up at redis+unix:///tmp/.../redis.socket
[2] resolve_storage_uri selected Redis ✔
[3] Redis-backed counting enforced: [200, 200, 200, 429] ✔
[4] Second 'worker' shares the same Redis counter → 429 ✔     ← the multi-worker fix, proven
[5] Persisted counter keys in Redis: ['LIMITS:LIMITER/127.0.0.1//limited/3/1/minute'] ✔
```

### 4.3 Degraded-mode verification
With Redis stopped, app import logs exactly one warning and continues serving with in-memory limits:

```
WARNING:app.rate_limit:Rate limiting: Redis unavailable (ConnectionError: …) —
falling back to in-memory storage. Limits will NOT be shared across workers …
```

## 5. Operations notes

- **Production:** point `REDIS_URL` at the same Redis used elsewhere; no extra setup. Verify the log line `Rate limiting: shared Redis storage at …` at startup.
- **Kubernetes/cloud LB with public IPs:** add them to `TRUSTED_PROXIES`.
- **Scaling:** fixed-window counters in Redis add one `INCR`+`EXPIRE` round-trip per limited request; negligible at this platform's RPS and shared across unlimited workers.
- **Known limitation (documented, intentional):** if Redis dies *after* startup, slowapi's built-in fallback handles per-request degradation; the startup check runs once per boot.
