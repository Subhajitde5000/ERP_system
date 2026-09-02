-- ============================================================================
--  PARENT PORTAL — Parent–Student Connected Access
--  Delta migration: run this on an EXISTING database.
--
--    psql -U erp_user -d erp_db -f database/update_parent_portal.sql
--
--  Everything here is additive. `parent_student_links` already exists in
--  database.sql (id / tenant_id / parent_id / student_id / relation /
--  is_primary / created_at) — nothing in that shape is changed, so an
--  institution that already has links keeps working the moment this runs.
--  New columns are either defaulted or nullable for exactly that reason.
--
--  What the new columns buy:
--    status          the link becomes an access grant, not just a row:
--                    PENDING_CLAIM → ACTIVE → SUSPENDED. A school can pause
--                    a guardian's access (custody order, fee dispute) without
--                    deleting the history, and re-open it later.
--    parent_email    lets the school record a link before the guardian has an
--                    account. parent_id becomes nullable: the invite sits as
--                    PENDING_CLAIM until it is claimed.
--    activation_code the "guardian code" printed on the admission slip. The
--                    parent enters it in the portal and the link connects to
--                    the account they authenticated with — no shared
--                    spreadsheet, no admin keying of accounts.
--    access_scope    which modules this guardian may open. Two parents of the
--                    same child legitimately see different things (a
--                    non-payer guardian does not need the fee ledger).
--    access_upto     time-boxed access for a grandparent or a temporary
--                    guardian; the reader fails closed after the date.
--    managed_by      who granted/changed it — the audit question that always
--                    comes back in a dispute.
--
--  Idempotent: safe to run twice.
-- ============================================================================

BEGIN;

-- ── 1. parent_student_links ────────────────────────────────────────────────

ALTER TABLE parent_student_links
  ADD COLUMN IF NOT EXISTS status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS parent_email    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS activation_code VARCHAR(24),
  ADD COLUMN IF NOT EXISTS code_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_scope    TEXT[] NOT NULL
    DEFAULT ARRAY['attendance','timetable','examination','assignment','results','notice','finance']::text[],
  ADD COLUMN IF NOT EXISTS access_upto     DATE,
  ADD COLUMN IF NOT EXISTS managed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS note            TEXT,
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- An invited link has no account yet, so parent_id must allow NULL. Every row
-- still has to identify a guardian one way or the other.
ALTER TABLE parent_student_links ALTER COLUMN parent_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_parent_student_links_status'
  ) THEN
    ALTER TABLE parent_student_links
      ADD CONSTRAINT ck_parent_student_links_status
      CHECK (status IN ('PENDING_CLAIM','ACTIVE','SUSPENDED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_parent_student_links_guardian'
  ) THEN
    ALTER TABLE parent_student_links
      ADD CONSTRAINT ck_parent_student_links_guardian
      CHECK (parent_id IS NOT NULL OR parent_email IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_parent_student_links_activation'
  ) THEN
    -- A code only ever exists on a link that is still waiting to be claimed.
    ALTER TABLE parent_student_links
      ADD CONSTRAINT ck_parent_student_links_activation
      CHECK (activation_code IS NULL OR status = 'PENDING_CLAIM');
  END IF;
END $$;

-- Backfill: every pre-existing link was already usable, so it is ACTIVE and
-- carries the full default scope the reader expects.
UPDATE parent_student_links
   SET status = 'ACTIVE'
 WHERE status IS NULL OR status = '';

-- ── 2. Indexes ─────────────────────────────────────────────────────────────

-- The portal's hot path: "which children may this signed-in guardian see".
CREATE INDEX IF NOT EXISTS idx_parent_student_links_parent_active
  ON parent_student_links (tenant_id, parent_id, status)
  WHERE parent_id IS NOT NULL;

-- Admin lookup when resolving an invite by email (the service stores
-- guardian emails lower-cased, so a plain column index is enough).
CREATE INDEX IF NOT EXISTS idx_parent_student_links_pending_email
  ON parent_student_links (tenant_id, parent_email)
  WHERE parent_email IS NOT NULL;

-- Claim-by-code. Unique: one code can never resolve to two children, which is
-- what makes a guessed code useless rather than a way to pick a family.
CREATE UNIQUE INDEX IF NOT EXISTS uq_parent_student_links_activation_code
  ON parent_student_links (activation_code)
  WHERE activation_code IS NOT NULL;

-- Exactly one primary *live* guardian per student. `is_primary` decides who is
-- contacted first for an absence or a fee reminder, so two primaries is a
-- data bug, not a preference. Demote-then-promote in the service plus this
-- index means it cannot survive a concurrent admin double-click.
CREATE UNIQUE INDEX IF NOT EXISTS uq_parent_student_links_primary_active
  ON parent_student_links (tenant_id, student_id)
  WHERE is_primary AND status = 'ACTIVE';

-- A guardian account is linked at most once per student (already guaranteed by
-- uq_parent_student_links__parent_id_student_id, but that constraint allows
-- NULL parent_id rows; this one guards the email side of the invite flow).
CREATE UNIQUE INDEX IF NOT EXISTS uq_parent_student_links_pending_email_student
  ON parent_student_links (tenant_id, parent_email, student_id)
  WHERE parent_email IS NOT NULL AND parent_id IS NULL;

-- Every FK column has to be the leading column of an index (the schema's own
-- verification step enforces that), so `managed_by` gets one even though it is
-- only read by an audit enquiry.
CREATE INDEX IF NOT EXISTS idx_parent_student_links_managed_by
  ON parent_student_links (managed_by);

-- ── 3. attendance_leaves — who actually filed the request ──────────────────
-- In K-12 the guardian usually files the absence, not the child. A teacher
-- reviewing "fever, 3 days" without knowing whether it came from the parent or
-- the student is missing the context that decides how it is read.

ALTER TABLE attendance_leaves
  ADD COLUMN IF NOT EXISTS requested_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS request_source VARCHAR(20) NOT NULL DEFAULT 'STUDENT';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_attendance_leaves_request_source'
  ) THEN
    ALTER TABLE attendance_leaves
      ADD CONSTRAINT ck_attendance_leaves_request_source
      CHECK (request_source IN ('STUDENT','PARENT','STAFF'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_attendance_leaves_requested_by
  ON attendance_leaves (requested_by);

-- ── 4. Verification ────────────────────────────────────────────────────────
-- Prints the shape the application expects. If the column list below is short,
-- the migration did not run against this database.

DO $$
DECLARE
  v_columns  INTEGER;
  v_indexes  INTEGER;
  v_leave    INTEGER;
BEGIN
  SELECT count(*) INTO v_columns
    FROM information_schema.columns
   WHERE table_name = 'parent_student_links'
     AND column_name IN ('status','parent_email','activation_code','code_expires_at',
                         'claimed_at','access_scope','access_upto','managed_by','note','updated_at');
  IF v_columns <> 10 THEN
    RAISE EXCEPTION 'parent_student_links: expected 10 new columns, found %', v_columns;
  END IF;

  SELECT count(*) INTO v_leave
    FROM information_schema.columns
   WHERE table_name = 'attendance_leaves'
     AND column_name IN ('requested_by','request_source');
  IF v_leave <> 2 THEN
    RAISE EXCEPTION 'attendance_leaves: expected 2 new columns, found %', v_leave;
  END IF;

  SELECT count(*) INTO v_indexes
    FROM pg_indexes
   WHERE tablename = 'parent_student_links'
     AND indexname IN ('uq_parent_student_links_activation_code',
                       'uq_parent_student_links_primary_active',
                       'uq_parent_student_links_pending_email_student',
                       'idx_parent_student_links_parent_active',
                       'idx_parent_student_links_pending_email',
                       'idx_parent_student_links_managed_by');
  IF v_indexes <> 6 THEN
    RAISE EXCEPTION 'parent_student_links: expected 6 new indexes, found %', v_indexes;
  END IF;

  RAISE NOTICE 'parent portal migration OK — % link columns, % leave columns, % indexes',
    v_columns, v_leave, v_indexes;
END $$;

COMMIT;
