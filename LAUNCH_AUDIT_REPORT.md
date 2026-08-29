# ERP System — End-to-End Audit & Launch Readiness Report

**Date:** 2026-08-26
**Scope:** Full file-mode audit of `backend/` (FastAPI), `fontend/` (Next.js), `app/` (Expo mobile), `database/` (PostgreSQL schema), docs and deployment posture.
**Verification performed:** clean-install of backend deps, module-by-module import of the whole app, production build of the web frontend, and a full run of the backend test suite (392 tests).

---

## 1. System Overview

Multi-tenant SaaS ERP + LMS for schools/colleges/universities (AWS/Shopify-style: one platform account owns many isolated institutions).

| Component | Stack | Location |
|---|---|---|
| Backend API | FastAPI (async) + SQLAlchemy 2 + asyncpg + Alembic, APScheduler, slowapi | `backend/` |
| Web frontend | Next.js 16 / React 19 / TypeScript / Tailwind | `fontend/` |
| Mobile app | Expo SDK 57 / React Native 0.86, expo-router | `app/` |
| Database | PostgreSQL (132 tables in `database/database.sql`) + Alembic chain (head `c2d3e4f5a6b7`) | `database/`, `backend/app/alembic/` |

**Three login systems** with distinct JWT types (`platform` staff, `owner` customer accounts, `tenant` institution users), 16 modules, and 10+ role consoles (principal, VP, HOD, coordinator, exam controller, teacher, student, librarian, hostel warden, support).

### What we verified works

- ✅ Backend imports cleanly end-to-end (all modules, 388 routes registered) — *after* fix #1 below.
- ✅ Web frontend: `tsc --noEmit` clean and `next build` succeeds (all role consoles compile).
- ✅ **Full backend test suite: 392/392 passing** (was 13 failing at audit start).
- ✅ Auth design is solid: bcrypt cost 12, refresh tokens stored as SHA-256 hashes, role checks resolved from the DB (not stale JWT claims), token types cross-rejected between the three login systems, constant-time login with dummy hash, password-reset tokens hashed with 30-min expiry, forgot-password never reveals account existence.
- ✅ Tenant isolation: sampled services (library, hostel, coordinator, principal, VP) scope every query by `tenant_id`.
- ✅ Online-class file uploads: MIME allowlist, sanitized filenames, size caps.
- ✅ Rate limits exist on login/signup/reset endpoints (but see issue #4 — they break in production topology).
- ✅ Mobile app stores refresh tokens in `expo-secure-store` (better than the web).

---

## 2. Critical issues found (P0)

### 🔧 ALREADY FIXED in this audit (committed to working tree)

| # | Issue | Evidence | Fix applied |
|---|---|---|---|
| F1 | **Backend could not start from a clean install** — `scheduler_service.py` (imported by `main.py` at startup) imports `apscheduler`, which was missing from `requirements.txt` | Reproduced: `ModuleNotFoundError: No module named 'apscheduler'` on `from app.main import app` after clean `pip install -r requirements.txt` | Added `APScheduler==3.11.3` to `backend/requirements.txt`; verified all modules import and 388 routes register |
| F2 | **Principal notice endpoints crashed with HTTP 500** — `PrincipalNoticeDetail(**base.model_dump(), …, attachments=…)` passed `attachments` twice (it's already a field of `LeadershipNoticeRow`) → `TypeError` on every notice detail view and notice creation | Failing test + code inspection (`principal_service.py` lines ~1503, ~1578) | Rewrote both call sites to merge the attachments into the dumped dict; `test_principal_console.py` 22/22 pass |
| F3 | **Production secrets committed to git** — `backend/.env` tracked in git (commit `cf0ba9c`) containing the live `JWT_SECRET_KEY`, a Gmail app password, and DB credentials. Anyone with repo access can forge valid JWTs for **any** user, including platform admins | `git ls-files` shows `backend/.env` | Untracked via `git rm --cached backend/.env` (file kept locally; `.gitignore` already covers `.env*`). ⚠️ **Secrets remain in git history — rotation is mandatory, see action A1** |
| F4 | **Test suite was red (13 failures)** — mix of `.env` leaking into tests and tests drifting from the implementation | `pytest` run at audit start: `13 failed, 344 passed` | Fixed all 13 (details below). Suite now **357 passed, 0 failed** |
| F5 | **Rate limiting broken in production topology (issue A4)** — in-memory storage per worker + `get_remote_address` keying behind proxies, duplicated 7× across modules | Audit + code inspection; 7 duplicate `Limiter(key_func=get_remote_address)` instances | Shared Redis-backed limiter in new `app/rate_limit.py` with spoof-resistant client-IP keying; 7 duplicates removed; 17 new tests + live Redis verification. Full write-up: [`doc/RATE_LIMITING_PRODUCTION_FIX.md`](./doc/RATE_LIMITING_PRODUCTION_FIX.md). Suite now **374 passed, 0 failed** |
| F6 | **`/uploads` served publicly without authentication (issue A6)** — online-class materials, recordings and notice attachments downloadable by anyone with a URL | Live verification: `GET /uploads/...` returned 200 with no credentials | Public `StaticFiles` mount removed; new signed-URL endpoint `app/routers/files.py` (type-bound JWT, expiry, traversal guards, nosniff/attachment headers, Range support); URL emission signed in online-class + notice services; `uploads/` git-ignored; 11 new tests + live server verification. Full write-up: [`doc/UPLOADS_AUTHENTICATION_FIX.md`](./doc/UPLOADS_AUTHENTICATION_FIX.md). Suite now **385 passed, 0 failed** |
| F7 | **P1 hardening batch (issues H2–H7)** — two sources of schema truth; app-only tenant isolation; unbounded question-bank upload; weak seed passwords; static refresh tokens; no security headers | `alembic upgrade head` fails on a fresh DB (measured); 73 tenant-scoped tables with zero RLS; `await file.read()` uncapped; `admin123456` default + echoed; refresh tokens never rotated; empty `next.config.mjs` | Raw SQL is now the single schema path (Alembic archived to `backend/archive/alembic-legacy/`, `database/README.md` added, stale docs fixed); **Postgres RLS enabled** via `database/update_rls.sql` + app context wiring, with all 4 real-Postgres suites running under genuine enforcement as a non-superuser role; bounded upload (`BULK_IMPORT_MAX_MB`, shared `read_capped_upload`) — also fixed the latent `tags=` crash it exposed; seed scripts refuse production runs + required strong `--password`, never echoed; refresh tokens **rotate with reuse detection** (family kill) across tenant/platform/owner + all three clients; CSP/hardening headers on every frontend response (curl-verified). Full write-up: [`doc/PRODUCTION_HARDENING_H2_H7.md`](./doc/PRODUCTION_HARDENING_H2_H7.md). Suite now **392 passed, 0 failed** |

Details of the test-suite fixes:
- `.env` leak: the committed `.env` set `PUBLIC_ROOT_DOMAIN=localhost:3000`, breaking 4 signup/provisioning assertions. Added a `conftest.py` autouse fixture pinning `PUBLIC_ROOT_DOMAIN=xyz.com` for tests (same pattern as the existing mailer fixture), so the suite is deterministic regardless of a developer's local `.env`.
- Coordinator slot tests (3): predates the "class slot needs subject + assigned teacher" rule and double-booking checks; updated fixtures/payloads to the current validated flow.
- VP tests (4): asserted old error wording ("delegated department") and a 4-query notice detail (attachments query was added later). Updated tests; also improved the service messages to the clearer "A delegated department is required for …" wording.
- Exam lifecycle (1): test created the exam with `allow_review: True` yet asserted results stay gated — self-contradictory. Removed the flag so the test matches its stated intent (gate until teacher releases).

### 🚨 STILL OPEN — must fix before launch

| # | Issue | Why it's critical |
|---|---|---|
| A1 | **Leaked secrets still in git history** (JWT signing key, Gmail app password, DB password) | The JWT key can sign valid admin/tenant tokens until rotated. **Rotate `JWT_SECRET_KEY`, the Gmail app password, and the DB password now; re-run `create_superadmin`.** Consider history rewrite (BFG / `git filter-repo`) if the repo is public. |
| A2 | **Payments are mocked** — `POST /api/v1/public/orders/{order_id}/pay` marks any pending order PAID with `gateway="mock"` and immediately provisions a full institution (`signup_service.mark_paid`) | Anyone can get paid-plan institutions for free. Before public launch: wire Razorpay/Cashfree order-verify + webhook (the code marks this as the single integration point), or disable PURCHASE mode and allow TRIAL only. |
| A3 | **Quick-start docs are broken** — `README.md` & `MANUAL.md` reference `database/update.sql` and `database/update2.sql` (files don't exist) and `python run.py` (no `run.py` exists). MANUAL also names Alembic head `e7f2a6c3b904`; the real head is `c2d3e4f5a6b7`. | Nobody can follow the documented setup. Either restore the missing SQL files/`run.py` or rewrite the docs to the Alembic + `uvicorn app.main:app` path. |
| ~~A4~~ | ~~Rate limiting doesn't work in production topology~~ | ✅ **FIXED 2026-08-27** — see [`doc/RATE_LIMITING_PRODUCTION_FIX.md`](./doc/RATE_LIMITING_PRODUCTION_FIX.md). |
| A5 | **No per-account lockout** — `main.py` comment claims "Per-account lockout is enforced in the service layer", but `auth_service.py` has no failed-attempt counter/lockout anywhere | Credential stuffing against tenant logins (email *or* roll number) is practical. Add per-user failed-attempt tracking + temporary lockout + optional CAPTCHA. |
| ~~A6~~ | ~~`/uploads` is served publicly without authentication~~ | ✅ **FIXED 2026-08-27** — public mount removed; signed expiring URLs via `GET /api/v1/files/signed/{token}`. See [`doc/UPLOADS_AUTHENTICATION_FIX.md`](./doc/UPLOADS_AUTHENTICATION_FIX.md). |
| A7 | **No deployment artifacts at all** — no Dockerfile, docker-compose, CI/CD workflows, or prod runbook | Nothing reproducible to launch with. Minimum: backend + frontend Dockerfiles, compose for Postgres/Redis, GitHub Actions running lint/tests/build, and an env-var checklist. |
| A8 | **CORS is too permissive for production** — `allow_origin_regex` admits any subdomain of the root domain **plus `localhost`/`127.0.0.1` on any port**, with `allow_credentials=True` | Any page served from the user's own localhost (including malicious local apps) can make credentialed cross-origin calls to the API. Drop localhost/127.0.0.1 from the regex in prod and require `https`. |

---

## 3. High-priority issues (P1)

> **Status:** H2–H7 are **FIXED** (see [`doc/PRODUCTION_HARDENING_H2_H7.md`](./doc/PRODUCTION_HARDENING_H2_H7.md)).
> Only H1 (transactional email provider) remains open.

| # | Issue | Detail / Recommendation |
|---|---|---|
| H1 | **Transactional email runs on a personal Gmail account** (`desubhajit00@gmail.com` SMTP app password) | Gmail SMTP daily limits + reputation risk; verification/invite mail will land in spam or stop. Move to a transactional provider (SES/Postmark/Resend/Klaviyo already supported) with an authenticated sending domain (SPF/DKIM/DMARC). |
| ~~H2~~ | ~~Two sources of schema truth~~ | ✅ **FIXED** — raw SQL is the single path; Alembic archived to `backend/archive/alembic-legacy/`; `database/README.md` documents provisioning + upgrade policy; stale docs cleaned. |
| ~~H3~~ | ~~No row-level security~~ | ✅ **FIXED** — `database/update_rls.sql` enables FORCE RLS + `tenant_isolation` policy on all 73 tenant-scoped tables; app sets/propagates tenant context per request and resets pooled connections; all real-Postgres suites run under genuine enforcement. |
| ~~H4~~ | ~~Unbounded question-bank upload~~ | ✅ **FIXED** — shared bounded `read_capped_upload` (config `BULK_IMPORT_MAX_MB`, 413 over cap) for question-bank/staff/student imports; also fixed the latent `tags=` crash the new test exposed. |
| ~~H5~~ | ~~Weak seed passwords~~ | ✅ **FIXED** — seed scripts refuse `APP_ENV=production` (unless `--force`); `create_superadmin.py` requires a strong `--password` and never echoes it. |
| ~~H6~~ | ~~Static refresh token in localStorage~~ | ✅ **FIXED** — refresh tokens rotate on every use with reuse detection (revokes the whole session family) across tenant/platform/owner; all three clients adopt the rotated token. httpOnly-cookie storage remains a documented follow-up. |
| ~~H7~~ | ~~Empty `next.config.mjs`~~ | ✅ **FIXED** — CSP + nosniff/referrer/frame/permissions/HSTS headers on every response, built from `NEXT_PUBLIC_API_URL`; curl-verified. |

## 4. Medium / low issues (P2)

| # | Issue |
|---|---|
| M1 | `X-Forwarded-For` trusted without a proxy allowlist when recording session IPs (`auth_service._extract_ip`) — spoofable. |
| M2 | The committed (now-untracked) `.env` had `APP_ENV=production` with `PUBLIC_ROOT_DOMAIN=localhost:3000` — internally inconsistent; rebuild it from `.env.example`. |
| M3 | FastAPI `on_event` deprecation warnings — migrate startup/shutdown to lifespan handlers. |
| M4 | `passlib` uses deprecated `crypt` (noisy on Python 3.12, breaks on 3.13) — pin Python 3.11/3.12 or plan a passlib replacement. |
| M5 | Folder typo `fontend/` propagated through docs and scripts — cosmetic, but rename before more tooling builds on it. |
| M6 | Mobile app needs `EXPO_PUBLIC_API_URL` baked in at build time (defaults to `localhost:8000`); no EAS build config in repo. |
| M7 | `docs_url` gated on `APP_DEBUG` — good; keep `APP_DEBUG=false` in prod so `/docs` and stack traces stay hidden. |

---

## 5. Pre-launch checklist (recommended order)

### Day 0 — Security (do before anything is exposed)
1. ☐ **Rotate every secret in the leaked `.env`**: `JWT_SECRET_KEY`, Gmail app password, DB password (A1/F3). Invalidate the Gmail app password in the Google account.
2. ☐ Purge `backend/.env` from git history (BFG/`git filter-repo`) if the repo is public — or guarantee rotation covers it.
3. ☐ Restrict CORS: remove `localhost`/`127.0.0.1` from `allow_origin_regex`, https-only origins (A8).
4. ☑ ~~Put `/uploads` behind authorization or signed URLs (A6).~~ **DONE** — see [`doc/UPLOADS_AUTHENTICATION_FIX.md`](./doc/UPLOADS_AUTHENTICATION_FIX.md).

### Week 1 — Correctness & abuse-prevention
5. ☑ ~~Move rate limiting to Redis storage with a trusted-proxy IP key function (A4).~~ **DONE** — see [`doc/RATE_LIMITING_PRODUCTION_FIX.md`](./doc/RATE_LIMITING_PRODUCTION_FIX.md).
6. ☐ Implement per-account failed-login lockout for tenant/platform/owner logins (A5).
7. ☐ Decide payments posture for launch: integrate a real gateway verify/webhook **or** disable paid checkout and run trial-only (A2).
8. ☑ ~~Cap the question-bank import upload (H4).~~ **DONE** — shared bounded upload guard; see [`doc/PRODUCTION_HARDENING_H2_H7.md`](./doc/PRODUCTION_HARDENING_H2_H7.md).
9. ☐ Fix README/MANUAL quick-start so a new dev can actually run the system (A3).

### Week 2 — Deployment & operations
10. ☐ Add Dockerfiles + compose (API, web, Postgres, Redis) and a GitHub Actions pipeline: lint → pytest (now green) → `next build` (A7).
11. ☑ ~~Pick the single schema-migration path (Alembic vs raw SQL) and document it (H2).~~ **DONE** — raw SQL is canonical; Alembic archived; `database/README.md`.
12. ☐ Switch email to a real transactional provider + authenticated domain (H1).
13. ☐ Configure backups (Postgres PITR + `uploads/` object storage), log aggregation and uptime/alerting; add `/health` to monitoring.
14. ☑ ~~Enable Postgres RLS as second-line tenant isolation (H3).~~ **DONE** — `database/update_rls.sql` + app context wiring; integration suites run under enforced RLS.
15. ☐ Set real env per environment: `APP_DEBUG=false`, production `ALLOWED_ORIGINS`, `PUBLIC_ROOT_DOMAIN`, `NEXT_PUBLIC_API_URL`, `EXPO_PUBLIC_API_URL`.

### Before go-live
16. ☑ ~~Security headers in `next.config.mjs` (H7); consider httpOnly-cookie refresh tokens (H6).~~ **DONE** — CSP + hardening headers live; refresh rotation + reuse detection shipped (httpOnly-cookie storage is a documented follow-up).
17. ☐ Run one full provisioning drill: signup → verify email → trial → setup wizard → all 10 role consoles → online class → exam → result release.
18. ☐ Penetration test (or at minimum re-run this audit) after fixes land.
19. ☐ Data-protection review for student/minor data (consent, retention, right-to-erasure).

---

## 6. Reproducing the verification

```bash
# Backend (Python 3.11/3.12)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -c "from app.main import app; print(len(app.routes))"   # → 388
python -m pytest tests/ -q                                      # → 392 passed

# Web
cd ../fontend && npm ci && npx tsc --noEmit && npm run build    # → clean build
```

**Bottom line:** the architecture and codebase are in better shape than typical pre-launch ERPs — clean builds, a now-green 392-test suite (including four real-Postgres integration suites running under enforced row-level security), sound auth/tenant design. The launch blockers are operational, not structural: leaked secrets (rotate now), mock payments, ~~unauthenticated file serving~~ (fixed), ~~broken rate limiting behind proxies~~ (fixed), ~~dual schema paths / no RLS / unbounded upload / weak seeds / static refresh tokens / no security headers~~ (all fixed in the H2–H7 batch), and zero deployment automation. Fix the remaining open P0 items above and the system is launchable.
