# Super Admin Console — C-SA-01 … C-SA-08

End-to-end: database → API → client → hook → page. All eight pages from
`complete_webpage_developer_assignment.md` §2.1 now run on real data.

---

## What existed before

All eight pages rendered, but from `lib/platform-data.ts` fixtures. None of
the five API groups had been built, and every action printed the request it
would have sent:

```
// TODO(Dev-A): POST /api/v1/platform/tenants …
setDone(`POST /platform/tenants { … } — API not connected yet (Dev-A, C-SA-04).`)
```

---

## Deploying

```bash
# 1. Schema (raw SQL)
psql -f database/database.sql
psql -f database/update.sql
psql -f database/update2.sql          # ← new, idempotent

#    …or with Alembic (equivalent, and now single-headed again)
cd backend && alembic upgrade head

# 2. Catalogue, roles, plans, Super Admin
python backend/scripts/seed_data.py
python backend/scripts/create_superadmin.py \
  --email admin@xyz.com --password 'StrongPass!' --name "Super Admin"

# 3. Run
cd backend  && uvicorn app.main:app
cd fontend  && npm run build && npm start
```

Sign in at `app.xyz.com/platform/login` → lands on `/platform/dashboard`.

---

## The API (§2.1)

| Page | Route | Endpoint |
|---|---|---|
| C-SA-01 Dashboard | `/platform/dashboard` | `GET /platform/dashboard-stats` |
| C-SA-02 Institution list | `/platform/institutions` | `GET /platform/tenants` |
| C-SA-03 Institution detail | `/platform/institutions/:id` | `GET·PATCH /platform/tenants/:id`, `PUT …/active`, `DELETE` |
| C-SA-04 Create institution | `/platform/institutions/new` | `POST /platform/tenants` |
| C-SA-05 Plans | `/platform/plans` | `GET·POST /platform/plans`, `PATCH /platform/plans/:id` |
| C-SA-06 Platform users | `/platform/platform-users` | `GET·POST /platform/users`, `PATCH /platform/users/:id` |
| C-SA-07 Audit logs | `/platform/audit-logs` | `GET /platform/audit-logs` |
| C-SA-08 Settings | `/platform/settings` | `GET·PATCH /platform/settings` |

Every route is Super-Admin-only. Support/Sales/Finance authenticate against
the same `platform_users` table, so a valid token is not enough — one
`require_super_admin` dependency guards the whole router and returns 403.

Responses are camelCase on the wire (`Wire` base class in
`schemas/platform_admin.py`), matching `types/platform.ts` exactly, so the
client needs no key translation.

---

## Rules the console enforces

From `role_based_system_design.md` §4.1:

- **Reserved subdomains** — `admin`, `app`, `api`, `www`… are refused (409).
  A tenant may never claim a host the platform answers on.
- **Plan scoping** — a tenant can only enable modules its plan includes.
  Downgrading re-scopes `tenant_modules`, so a demoted tenant can't keep paid
  features. Core modules are always on (§3).
- **Last Super Admin** — cannot be deactivated or demoted, and you cannot
  deactivate yourself. Locking the console out of itself is unrecoverable
  without a DB edit.
- **Audit-only on tenant data** — the console edits *platform* concerns
  (plan, modules, lifecycle, profile). Academic records stay read-only.
- **Soft delete** — deactivate + cancel subscriptions. A hard `DELETE` would
  cascade through ~100 tables of academic history.
- **Audit trail** — every mutation writes `audit_logs` in the *same*
  transaction, so the trail can never disagree with reality. Append-only:
  there is no update or delete path (§10.3).

---

## Structure

```
backend/
├── app/models/audit.py                    AuditLog (§10.3)
├── app/models/platform_setting.py         key/value + code defaults
├── app/schemas/platform_admin.py          camelCase wire contracts
├── app/services/audit_service.py          record() + the C-SA-07 reader
├── app/services/platform_admin_service.py the console's logic
└── app/routers/platform/admin.py          the 13 routes

fontend/
├── lib/platform-api.ts                    typed client
├── hooks/use-platform-admin.tsx           useResource + 8 bindings
├── components/platform/live.tsx           <Live>, useAction, <ActionBar>
├── components/platform/consoles.tsx       hook → existing component
└── app/(platform)/layout.tsx              session gate
```

**No page layout was rewritten.** `InstitutionList`, `InstitutionDetail`,
`CreateInstitution`, `PlatformUsers` and `PlatformAuditView` keep their
existing props and markup; they only gained optional action callbacks
(`onSetActive`, `onCreate`, `onToggleActive`, `onInvite`). Omit the callback
and the original unwired preview behaviour returns, which is what `?role=`
still uses.

Loading, error, retry and mutation state live in `useResource` and `<Live>`
once, not eight times.

---

## Schema drift found and fixed

`update2.sql` adds `audit_logs`, `platform_settings` and the console's
indexes. Running it against a real PostgreSQL 16 also surfaced four
pre-existing mismatches between `database.sql` and the Alembic migrations.
Each broke production on a raw-SQL deployment:

| # | Drift | Symptom |
|---|---|---|
| 1 | `modules.price_monthly` missing | every Module query → `UndefinedColumnError` |
| 2 | `subscriptions.status` etc. are PG ENUMs; code sends VARCHAR | `DatatypeMismatchError` on **any** subscription insert — self-service signup was broken too |
| 3 | 8 tables only in Alembic (`orders`, `outbox_emails`, `platform_invoices`, `platform_payments`, `coupons`, `platform_sessions`, `platform_invoice_lines`, `support_ticket_messages`) | no billing or email layer at all |
| 4 | `orders.owner_name`, `support_tickets.owner_id`/`category` missing | owner dashboard queries failed |

After `update2.sql`, a from-scratch raw-SQL database has **zero** table or
column drift against the ORM.

Two unrelated pre-existing bugs also blocked the build and are fixed:
`lib/signup.ts` had a truncated duplicate `getJson()` from a bad merge (the
whole app failed `tsc`), and `/verify-email` used `useSearchParams` with no
Suspense boundary (`next build` prerender error).

---

## Verification

| Check | Result |
|---|---|
| Backend unit tests | **91 passed** (was 30 passing + 1 failing) |
| End-to-end vs. real PostgreSQL 16 | **73 assertions**, on both an upgraded and a from-scratch DB |
| Client↔server contract | **21 assertions** — every response matches `types/platform.ts` |
| `next build` | succeeds; all 8 routes compile |
| `tsc --noEmit` / ESLint | clean on all new files |

The end-to-end run covers authorisation (401/403/200), tenant CRUD with
provisioning side effects (admin user, role, academic year, activation
email), plan scoping, module downgrade, suspend/reactivate, staff management,
the last-Super-Admin guard, audit filters, settings persistence, and soft
delete.
