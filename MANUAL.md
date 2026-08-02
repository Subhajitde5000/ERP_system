# MANUAL.md — xyz.com ERP Platform

End-to-end operations manual for the xyz.com multi-tenant ERP + LMS platform.
Read this before deploying. It covers architecture, setup, the three login
systems, the live admin features, the API, and the production checklist.

---

## 1. What this system is

A **multi-tenant SaaS ERP + LMS** for schools, colleges and universities, modelled
on AWS / Shopify / Zoho:

- **One platform account owns many institutions.** A customer (e.g. Rahul,
  `rahul@gmail.com`) signs up once and runs Green College, ABC School and XYZ
  Academy under a single account, with consolidated billing and support.
- **Each institution is an isolated tenant** with its own subdomain
  (`green.xyz.com`), data, roles and modules.
- **16 modules** — 8 core (always on) + 8 optional (plan-gated).

There are **three identity tables / three login systems**, each with its own JWT
type so a token from one is never accepted by another:

| Identity | Table | Logs in at | JWT type | Purpose |
|---|---|---|---|---|
| Platform **staff** | `platform_users` | `/platform/login` (`app.xyz.com`) | `platform` | Super Admin / Support / Sales / Finance run xyz.com |
| Platform **owner** (customer) | `platform_owners` | `/account/login` (`xyz.com/login`) | `owner` | Owns institutions, billing, subscriptions, support |
| Institution **members** | `users` | `/login` (`green.xyz.com/login`) | `tenant` | Daily ERP: students, teachers, admins, … |

---

## 2. Architecture

```
fontend/   Next.js 16 (App Router) + React 19 + Tailwind
backend/   FastAPI + SQLAlchemy 2 (async) + asyncpg + Alembic + bcrypt + JWT
database/  database.sql (106-table base schema) + update.sql (post-base changes)
doc/       architecture, system-flow, owner-accounts, page specs
```

- **Backend** is fully async, tenant-scoped, RBAC-guarded. All responses use the
  `{ success, data, message }` envelope.
- **Frontend** has three surfaces:
  - **Public marketing site** (`/`, `/features`, `/pricing`, …) — no auth.
  - **Owner console** (`/account/*`) — owner JWT, manages institutions/billing.
  - **Institution console** (`/admin/*` real admin; `(institution)/*` legacy
    module-preview pages — see §7).
- **Auth** stores the short-lived access token in memory only; the refresh token
  is in `localStorage` (tenant + owner) or memory (staff). Passwords are bcrypt
  cost-12; refresh tokens are SHA-256 hashed at rest.

---

## 3. Prerequisites

- Python **3.11+**, Node.js **20+**, npm
- **PostgreSQL 15+** (developed on 17)
- Redis (optional; reserved for caching/rate-limit backing)

---

## 4. First-time setup

### 4.1 Database

```bash
# 1. Create the DB and user
psql -U postgres -c "CREATE USER erp_user WITH PASSWORD 'erp_password';"
psql -U postgres -c "CREATE DATABASE erp_db OWNER erp_user;"

# 2. Base schema (106 tables + role/permission/module seeds)
psql -U erp_user -d erp_db -f database/database.sql

# 3. Post-base updates (owner accounts, academic link tables, role seed guards)
psql -U erp_user -d erp_db -f database/update.sql
```

> **Alembic-managed deployments** instead of raw SQL:
> ```bash
> cd backend && alembic upgrade head
> ```
> The migrations (`c6bcf…` → … → `f3b4c6d8e9a1`) reproduce everything
> `database.sql` + `update.sql` create. Pick **one** path (raw SQL **or**
> Alembic), not both on the same DB.

### 4.2 Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env       # then edit values (see §8 Production checklist)
python scripts/seed_data.py        # catalogue, plans, 22 roles, demo tenant + users
python run.py                     # dev server on :8000  (python run.py --prod for prod)
```

Seed also creates a demo institution (`abc-college`) with an INSTITUTION_ADMIN
so you can explore `/login` → `/admin` immediately. See `seed_data.py` for the
demo credentials.

Create platform **staff** (Super Admin etc.) separately:

```bash
python scripts/create_superadmin.py --email admin@xyz.com --password 'StrongPass!' --name "Super Admin"
```

### 4.3 Frontend

```bash
cd fontend
npm ci
cp .env.example .env.local      # set NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                     # http://localhost:3000
```

### 4.4 Smoke test

1. `GET http://localhost:8000/health` → `{"status":"healthy"}`.
2. Visit `http://localhost:3000` (marketing site) → **Start free** → create an
   owner account → verify email (dev returns the link on-screen) → `/account`.
3. From `/account` → **New institution** → checkout → institution provisioned.
4. Open the institution login (`/login` for the seeded `abc-college` tenant, or
   your new subdomain) as the admin → `/admin/dashboard`.

---

## 5. The three login systems

### 5.1 Owner (customer) — `xyz.com/login` → `/account/login`
- `POST /api/v1/owner/signup` → `POST /owner/verify-email` → `POST /owner/login`.
- Email **must** be verified before login is allowed.
- Owns institutions, billing, subscriptions, invoices, payments, support tickets,
  profile. See `doc/PLATFORM-OWNER-ACCOUNTS.md`.

### 5.2 Institution member — `green.xyz.com/login` → `/login`
- `POST /api/v1/tenant/auth/login` `{ slug, identifier, password }`.
- `identifier` is an **email or roll number**. JWT is bound to the tenant
  (`tenant_id`) and the origin — replaying it against another institution fails.
- Institution Admins land on the **real** admin console at `/admin/dashboard`.

### 5.3 Staff (xyz.com employees) — `app.xyz.com/login` → `/platform/login`
- `POST /api/v1/platform/auth/login`. Created via `create_superadmin.py` or seed.

> On a single-origin dev deploy these are three **paths**; in production they are
> three **hosts** (rewrite `xyz.com/login`→`/account/login`,
> `app.xyz.com/login`→`/platform/login`, `*.xyz.com/login`→`/login`).

---

## 6. Institution Admin — what is LIVE (real backend, no demo data)

The `/admin/*` console is fully wired to the backend at `/api/v1/institution/*`.
All routes require a `type="tenant"` JWT whose user holds the
**INSTITUTION_ADMIN** role (RBAC is read live from `role_assignments`).

| Page | Backend | What works |
|---|---|---|
| `/admin/dashboard` | `GET /institution/dashboard` | Real counts (years, departments, classes, subjects, staff, students), enabled modules, onboarding state |
| `/admin/academic-years` | `/institution/academic-years` | Create / list / set-current / delete; exactly one current per tenant |
| `/admin/departments` | `/institution/departments` | Create / list / update (HOD) / delete (blocked if classes exist) |
| `/admin/staff` | `/institution/staff` | List, invite (set-password link emailed), assign roles |
| `/admin/modules` | `/institution/modules` | List + toggle; core locked, optional **plan-gated** (402 if not in plan) |
| `/admin/settings` | `/institution/settings` | Timezone / currency |
| `/admin/profile` | `/institution/profile` | View + edit institution details |

Plus backend-only (ready to wire): `/institution/classes`, `/subjects`,
`/students`, `/enrollments`, `/staff/{id}/roles`, `/staff/{id}/active`.

Staff/student invites use the **reset-token flow**: the new user is created with
no password and a one-time token; a "set your password" email is queued in
`outbox_emails`. The platform never knows anyone's password.

---

## 7. Module workflows — status

The deeper role workflows under `(institution)/*` (attendance marking, exams,
fees, library, hostel, timetable, etc.) currently read from in-memory **demo
data** (`lib/*-data.ts`) and the demo `getSession`. They render for every role
for preview/QA but are **not yet wired to the backend**.

The migration pattern is established and identical for each:
1. Add an ORM model (most tables already exist in `database.sql`).
2. Add a service + `/api/v1/institution/<feature>` router (RBAC-scoped).
3. Add a `lib/institution.ts` call + a `/admin/<feature>` client page (or convert
   the existing `(institution)/<feature>` page), removing its `*-data.ts`.

`update.sql` is the single place to record any new schema those features need.

---

## 8. Production checklist

- [ ] **Secrets** — `JWT_SECRET_KEY` a 64-hex random string; rotate periodically.
      `APP_DEBUG=false` (hides `/docs`, `/redoc`, stack traces; also hides the
      raw email-verification token from API responses).
- [ ] **Database** — `update.sql` applied (or `alembic upgrade head`); backups on.
- [ ] **CORS** — `ALLOWED_ORIGINS` lists only your real origins
      (`https://xyz.com,https://app.xyz.com`, approved tenant origins).
- [ ] **Email** — wire an outbound provider to drain `outbox_emails`
      (`tenant.provisioned`, `staff.invited`, `owner.verify_email`). Until then,
      verification/invite links are only visible in dev mode / the DB.
- [ ] **Payments** — replace the mock gateway in
      `SignupService.mark_paid` with a real Razorpay/Cashfree webhook handler
      (SYSTEM-FLOW §9.1; `UNIQUE(gateway, gateway_ref)` already guards replays).
- [ ] **DNS / hosts** — apex `xyz.com`, staff `app.xyz.com`, tenant `*.xyz.com`.
- [ ] **Frontend build** — `npm run build` in CI (needs network for Google Fonts;
      offline builds fail only on font fetch, not on code).
- [ ] **Process** — run the backend with `python run.py --prod` (4 workers) or a
      process manager; serve the frontend via `next start` or a CDN.
- [ ] **Rate limits** — already set per endpoint via `slowapi`; front with your
      proxy's limits too.

---

## 9. API quick reference

All under `/api/v1`. Authenticated routes take `Authorization: Bearer <jwt>`.

| Group | Prefix | Key endpoints |
|---|---|---|
| Owner (customer) | `/owner` | `/signup`, `/verify-email`, `/login`, `/me`, `/institutions`, `/billing/summary`, `/subscriptions`, `/invoices`, `/payments`, `/tickets`, `/orders` (+ `/pay`) |
| Public signup | `/public` | `/catalog`, `/subdomains/check`, `/quote`, `/orders` (+ `/pay`), `/service-requests` |
| Institution admin | `/institution` | `/dashboard`, `/academic-years`, `/departments`, `/classes`, `/subjects`, `/staff`, `/students`, `/enrollments`, `/modules`, `/settings`, `/profile` |
| Tenant auth | `/tenant/auth` | `/login`, `/logout`, `/refresh`, `/me`, `/forgot-password`, `/reset-password` |
| Platform staff auth | `/platform/auth` | `/login`, `/logout`, `/refresh`, `/me` |
| Setup wizard | `/setup` | `GET`, `PUT`, `POST /complete` |

OpenAPI: with `APP_DEBUG=true`, browse `http://localhost:8000/docs`.

---

## 10. Running the tests

```bash
cd backend
pytest -q          # 31 tests: auth, signup/provisioning, owner flow, institution admin
```

Tests use scripted fake DB sessions (no Postgres required) and cover the
provisioning pipeline, gapless invoicing, owner signup→verify→login, and the
institution-admin RBAC guard + plan-gated modules.

---

## 11. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `401 Could not validate …` | Token missing, expired, or wrong type for the endpoint. Re-login; owner tokens are `type=owner`, institution `type=tenant`, staff `type=platform`. |
| `403 Institution admin privileges are required` | The tenant user does not hold the INSTITUTION_ADMIN role in `role_assignments` for their tenant. Grant it (seed/setup wizard). |
| `402 … not included in your plan` | Optional module toggle blocked by `plans.allowed_modules`. Upgrade the plan. |
| `next build` fails on Google Fonts | Build host has no network. Pre-build fonts or run in CI with network. Code is unaffected. |
| Email links never arrive | No outbound provider draining `outbox_emails`. In dev (`APP_DEBUG=true`) the owner verification token is returned in the signup response. |
| Migration conflict | Ensure a single source: raw SQL (`database.sql` + `update.sql`) **or** Alembic (`alembic upgrade head`), not both. Head revision is `f3b4c6d8e9a1`. |

---

## 12. Documentation index

- `doc/ARCHITECTURE.md` — system architecture
- `doc/SYSTEM-FLOW.md` — lead → purchase → onboarding → daily operation
- `doc/PLATFORM-OWNER-ACCOUNTS.md` — the account-holder (multi-institution) model
- `doc/database_design_complete.md`, `doc/role_based_system_design.md`
- `doc/PAGES-TODO.md` — page coverage matrix

_Manual v1.0 — verified against the 106-table schema, the Alembic head
`f3b4c6d8e9a1`, and the live `/admin` console._
