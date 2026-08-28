# Archived Alembic chain (DO NOT USE)

**Status: archived 2026-08-28 — audit issue H2 ("two sources of schema truth").**

## Why this was archived

The project grew two parallel schema mechanisms:

1. **Raw SQL** — `database/database.sql` (the complete 132-table schema,
   verified end-to-end against PostgreSQL 17) plus the incremental module
   migrations in `database/`.
2. **This Alembic chain** — originally generated as *drift-repair* revisions
   to be run on top of a database already built from `database.sql`.

The Alembic chain **cannot bootstrap a fresh database**. Verified on a clean
PostgreSQL instance: `alembic upgrade head` fails with
`relation "audit_logs" does not exist` because early revisions alter tables
that only `database.sql` creates. Meanwhile the raw-SQL path provisions
everything the ORM models need.

Keeping both invited the exact failure the audit flagged: operators could
pick the broken path, or run both and fight migration conflicts (see
MANUAL's old "Migration conflict" troubleshooting row).

## Decision

The raw SQL files in `database/` are the **single source of schema truth**.
See `database/README.md` for the canonical provisioning order.

## Contents

- `alembic.ini` + `env.py` + `script.py.mako` + `versions/` — the historical
  revision chain (`d606a76a8b70` initial → `c2d3e4f5a6b7` head). Kept for
  reference only, e.g. to understand what a legacy deployment applied.
- `script_location` was repointed to this directory so the files remain
  self-describing, but nothing in the app references them anymore.

## If you find an `alembic_version` table in a live database

It records which legacy revisions were applied on top of `database.sql`.
No new revisions will ever be published; future schema changes ship as raw
SQL migration files in `database/` (one file per change + the updated main
schema), per the project's database-change policy.
