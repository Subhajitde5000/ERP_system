# Production Hardening — Audit Issues H2–H7

Date: 2026-08-28 · Branch: `arena/01a03fab-erp-system` · Companion to `LAUNCH_AUDIT_REPORT.md`

All six P1 issues are fixed, tested, and verified. Backend suite: **392/392 passed**
(was 385 before this batch — 7 new tests added). Frontend `next build` clean and
security headers verified live.

---

## H2 — Two sources of schema truth → raw SQL is now the only path

**Problem.** `database/database.sql` (132 tables) and the Alembic chain both claimed to
define the schema. Measurement showed the Alembic chain was built as *drift-repair on top
of database.sql* and **cannot bootstrap a fresh database**: `alembic upgrade head` on a
clean PostgreSQL fails with `relation "audit_logs" does not exist`. Operators who picked
the Alembic path would get a broken install; mixing both caused migration conflicts.

**Fix.**
- Verified end-to-end what each path produces (ORM models = 99 tables; `database.sql`
  covers all of them plus 35 future-module tables; only `class_grades`/`class_programs`
  live in an incremental file).
- **Archived the Alembic chain** to `backend/archive/alembic-legacy/` (with a README
  explaining why and what `alembic_version` means in legacy deployments). The app no
  longer references it; running `alembic` from `backend/` now fails loudly instead of
  silently corrupting a fresh DB.
- **`database/README.md` (new)** — canonical provisioning guide:
  fresh install = `database.sql` → `class_hierarchy_migration.sql` → `update_rls.sql`,
  ordered upgrade list for existing deployments, and a schema-change policy requiring
  every change to ship as *migration SQL + folded into database.sql + ORM model*.
- Fixed every stale doc reference (README quickstart pointed at nonexistent
  `update.sql`/`update2.sql`; MANUAL + support/super-admin console docs referenced the
  archived chain and a fictional head revision).

**Files:** `backend/archive/alembic-legacy/*`, `database/README.md`, `README.md`,
`MANUAL.md`, `doc/SUPER-ADMIN-CONSOLE.md`, `doc/SUPPORT-CONSOLE.md`.

---

## H3 — Row-Level Security: tenant isolation now enforced by PostgreSQL

**Problem.** Tenant isolation was application-only — a single missed `tenant_id` filter
would leak cross-tenant data. The RLS template in `database.sql` had been commented out
since design.

**Fix — database side** (`database/update_rls.sql`, step 3 of the canonical install):
- Idempotent DO-block walks every table with a `tenant_id` column (73 tables today) and
  `ENABLE` + `FORCE ROW LEVEL SECURITY` + installs one `tenant_isolation` policy:
  `tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
   OR current_setting('app.rls_bypass', true) = 'on'` (both `USING` and `WITH CHECK`).
- Closed by default: no context → zero rows visible. Operational notes in the file
  (app role must not be SUPERUSER/BYPASSRLS; maintenance must set the bypass GUC).

**Fix — application side:**
- `backend/app/utils/rls.py` (new): `set_tenant_context()` / `enable_rls_bypass()` /
  pool-level `reset_rls_context_raw()`. The context is **sticky**: it's stored on
  `session.info` and re-applied by an `after_begin` listener whenever a transaction
  starts on a (possibly brand-new) connection — critical because SQLAlchemy releases
  connections back to the pool after every commit, which would otherwise silently drop
  the GUCs mid-request (this exact failure mode was caught and fixed during testing).
- `app/database.py`: pool `checkin` event wipes both GUCs on every returned connection,
  so a tenant context can never leak into another request.
- `app/dependencies/auth.py`: tenant users → bootstrap lookup with bypass, then the
  session is scoped to their tenant before any service query runs; platform/owner staff
  → bypass (they legitimately work cross-tenant); new `rls_public_bypass` dependency
  marks the few pre-auth endpoints that must touch tenant-scoped tables (login, refresh,
  password reset, order create/pay/status) — every bypass is explicit and reviewable.
- `online_class.py` WebSocket: same bypass-then-scope pattern after token validation.
- Seed scripts set the bypass before writing.

**Tests (the proof).** `tests/conftest.py::enable_rls_enforcement()` applies
`update_rls.sql` to the embedded test Postgres and returns a **non-superuser app role**
URI (superusers always bypass RLS — enforcement tests must run as a plain role). All
four real-Postgres integration suites (institution, teacher/student, online class incl.
live WebSocket, refresh rotation) now execute entirely under enforced RLS:
- Verified genuinely enforced: 73 policies installed; no-context connection sees 0 rows.
- Caught and fixed two real bugs this surfaced: the WS session lost its RLS context
  across commits (the sticky redesign above), and question-bank import crashed on
  `tags=` (see H4).

**Files:** `database/update_rls.sql`, `backend/app/utils/rls.py`, `backend/app/database.py`,
`backend/app/dependencies/auth.py`, `backend/app/routers/{tenant/auth,public/signup,online_class}.py`,
`backend/scripts/{seed_data,seed_all_roles_users}.py`, `backend/tests/conftest.py` +
the 4 integration test files.

---

## H4 — Unbounded question-bank upload → bounded like every other bulk import

**Problem.** `POST /teacher/question-bank/import-file` did `await file.read()` with no
cap (memory-exhaustion DoS), while staff/student imports enforced 2 MB.

**Fix.**
- New setting `BULK_IMPORT_MAX_MB` (default 2) — one knob for all bulk imports.
- `read_capped_upload()` in `institution_service.py` — bounded read + 413. Question-bank
  import, staff bulk and student bulk now all share this one helper (the three
  duplicated inline guards were removed, per the no-duplication policy).
- **Bonus real bug found by the new test:** `import_question_bank_file` passed `tags=`
  to `_save_to_question_bank`, which didn't accept it — every question-bank import
  crashed with a 500. `_save_to_question_bank` now accepts and persists tags (the model
  column already existed).

**Tests:** `test_question_bank_import_enforces_size_cap` (valid JSON imports; >2 MB →
413) and `test_staff_bulk_upload_enforces_size_cap` in `test_institution_integration.py`,
running under enforced RLS.

**Files:** `backend/app/config.py`, `backend/app/services/{institution_service,teacher_service}.py`,
`backend/app/routers/{teacher,institution/people}.py`, tests as above.

---

## H5 — Weak seed credentials can no longer reach production

**Problem.** `create_superadmin.py` defaulted to `admin123456` and *echoed the password
to stdout*; `seed_data.py` / `seed_all_roles_users.py` write well-known passwords
(`adminpassword123`, `Password123!`, …) with nothing stopping a production run.

**Fix.**
- `scripts/common.py` (new, shared — no duplicated guard code):
  - `refuse_in_production()` — aborts any seed script when `APP_ENV=production` unless
    `--force` is passed (staging escape hatch). Wired into all three scripts.
  - `validate_password_strength()` — min 10 chars, ≥3 character classes, not the email.
- `create_superadmin.py`: `--password` is now **required** (no default), the password is
  strength-checked and **never printed** (removed from output; stdout/history must not
  carry live credentials).
- Also fixed a latent bug: all three scripts failed with `ModuleNotFoundError: app` when
  run as documented (`python scripts/…`) — they now bootstrap `sys.path` properly.

**Verified manually:** production abort, `--help` passthrough, missing/weak/strong
password behaviours all exercised.

**Files:** `backend/scripts/{common,create_superadmin,seed_data,seed_all_roles_users}.py`.

---

## H6 — Refresh tokens now rotate, with reuse detection (all three login systems)

**Problem.** Refresh tokens were static until logout/expiry; a stolen one worked
indefinitely. The web app also stored it in localStorage.

**Fix — backend (no schema change needed):**
- Shared helpers in `auth_service.py`: `rotate_session()` (revoke presented session,
  issue replacement, inherit device/IP audit context) and `abort_on_reuse()` (a revoked
  token presented again = likely theft → revoke the user's **entire session family**,
  commit immediately, log a SECURITY warning, reject).
- Wired into **tenant**, **platform**, and **owner** refresh. `AccessTokenResponse` now
  carries `refresh_token`.
- Subtlety handled: the family-revocation commit happens *before* raising 401 (otherwise
  the exception would roll the kill switch back).

**Fix — clients adopt the rotated token:**
- `fontend/lib/auth.ts` (tenant localStorage flow + in-memory platform flow) and
  `app/src/lib/auth.ts` (mobile SecureStore flow) store the replacement on every refresh.
- Remaining exposure (XSS reading localStorage) is mitigated by the short rotation
  window: a stolen token dies on the victim's next refresh, and any replay kills the
  whole family. httpOnly-cookie storage is documented as the follow-up.

**Tests:** `tests/test_refresh_rotation.py` (5 tests, real Postgres, enforced RLS):
rotation returns a new token, old token dies, **reuse revokes the whole family** (fresh
token also dies, re-login recovers), invalid tokens rejected — for tenant and platform.

**Files:** `backend/app/services/{auth_service,owner_service}.py`,
`backend/app/schemas/auth.py`, `fontend/lib/auth.ts`, `app/src/lib/auth.ts`,
`backend/tests/test_refresh_rotation.py`.

---

## H7 — Security headers on every frontend response

**Problem.** `fontend/next.config.mjs` was empty — no CSP, no frame protection, no
referrer policy.

**Fix.** `next.config.mjs` now emits on all routes:
- **Content-Security-Policy** built dynamically from `NEXT_PUBLIC_API_URL`:
  `default-src 'self'`; `script-src 'self' 'unsafe-inline'` (+`'unsafe-eval'` in dev
  only); `img-src 'self' data: blob: https:`; `font-src 'self' data:`;
  `connect-src 'self'` + API http/https/ws(s) origins; `frame-src 'none'`;
  `frame-ancestors 'none'`; `form-action 'self'`; `base-uri 'self'`; `object-src 'none'`;
  `upgrade-insecure-requests` on non-localhost.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `X-Frame-Options: DENY`, `Permissions-Policy` (camera/mic/geo/payment off), HSTS on
  non-localhost production.
- Documented trade-off: `unsafe-inline` for scripts stays because Next bootstraps inline;
  remote-script injection is still blocked. Nonce hardening is a tracked follow-up.

**Verified:** `next build` clean; `next start` + curl shows the full header set served.

**Files:** `fontend/next.config.mjs`.

---

## Verification summary

| Check | Result |
|---|---|
| Full backend suite | **392/392 passed** (4 real-PG suites under enforced RLS) |
| RLS genuinely enforced | 73 `tenant_isolation` policies; app-role, no-context query sees 0 rows |
| Frontend build | `next build` clean |
| Security headers | curl-verified on `next start` |
| Seed guards | manual verification of abort/help/password paths |
| Stale docs | zero remaining references to archived Alembic or dead SQL files |

## Follow-ups (documented, not in scope here)

1. Nonce-based CSP to drop `'unsafe-inline'` (H7).
2. Move web refresh token to an httpOnly Secure cookie (H6).
3. Re-run `update_rls.sql` whenever a new tenant-scoped table is added (also documented
   in `database/README.md`).
