# Database Schema — Canonical Provisioning Guide

**Single source of schema truth: the raw SQL files in this directory**
(decision recorded for audit issue H2; the former Alembic chain is archived
in `backend/archive/alembic-legacy/` — see its README for why).

Target: **PostgreSQL 15+** (verified on 17.10).

---

## Fresh install

Run in order, with `ON_ERROR_STOP=1` so any failure aborts loudly:

```bash
createdb erp_db
psql -U erp_user -d erp_db -v ON_ERROR_STOP=1 -f database/database.sql
psql -U erp_user -d erp_db -v ON_ERROR_STOP=1 -f database/class_hierarchy_migration.sql
psql -U erp_user -d erp_db -v ON_ERROR_STOP=1 -f database/update_rls.sql
```

| # | File | Purpose |
|---|------|---------|
| 1 | `database.sql` | Complete base schema: enums, 130+ tables, FK indexes. Verified end-to-end. |
| 2 | `class_hierarchy_migration.sql` | Adds `class_grades` / `class_programs` (academic group hierarchy) — **not** part of `database.sql`, required by the ORM models. |
| 3 | `update_rls.sql` | Enables Postgres Row-Level Security on every tenant-scoped table (defence-in-depth, audit issue H3). See comments in that file for how the app sets tenant context. |

Then seed reference data (dev only — seed scripts refuse to run when
`APP_ENV=production`, audit issue H5):

```bash
cd backend
python scripts/seed_data.py
python scripts/create_superadmin.py --email admin@school.com --password '<strong>'
```

## Upgrading an existing deployment

Apply only the migration files newer than your deployment, in this order
(each is additive and safe to run once):

1. `class_hierarchy_migration.sql` — class hierarchy tables
2. `question_bank_migration.sql` — question bank (already in `database.sql`;
   only needed for pre-question-bank databases)
3. `group_project_migration.sql` → `group_collaboration_migration.sql` →
   `group_invitations_migration.sql` — group projects (order matters;
   collaboration and invitations depend on `project_groups`)
4. `online_class_migration.sql` → `online_class_production_update.sql` —
   live classes (second file depends on the first)
5. `hostel_production_migration.sql`, `library_production_migration.sql`,
   `update_notice_attachments.sql` — module hardening; `database.sql` already
   contains their final state, so they are effectively no-ops on a fresh DB
6. `update_rls.sql` — RLS enablement (safe to run anytime; idempotent)

## Schema change policy (prevents a second source of truth)

Every schema change must ship **all three** in one commit:

1. A new migration SQL file in this directory (the update part, named
   `update_<feature>.sql` or `<feature>_migration.sql`);
2. The matching change folded into `database.sql` (the main file stays the
   complete schema);
3. The ORM model update in `backend/app/models/`.

Tests create the schema from the ORM models
(`Base.metadata.create_all`), so a model that disagrees with this directory
fails CI the moment a real-Postgres integration test touches the column.

## What about Alembic?

Archived — it never worked on fresh databases (its early revisions modify
tables only `database.sql` creates) and running both paths caused migration
conflicts. Details: `backend/archive/alembic-legacy/README.md`.
