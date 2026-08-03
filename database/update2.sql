-- ============================================================================
-- update2.sql — Platform consoles + academic leadership governance (C-SA, C-PR, C-HD, C-AC)
-- ============================================================================
-- Applies AFTER database.sql and update.sql. Every block is idempotent, so
-- re-running is safe, and each section is mirrored by the corresponding
-- Alembic migration under backend/app/alembic/versions/.
--
-- Apply order on a fresh DB:
--   1. psql -f database/database.sql        (base schema + seeds)
--   2. psql -f database/update.sql          (owner accounts, academic links)
--   3. psql -f database/update2.sql         (this file)
--   4. python backend/scripts/seed_data.py  (catalogue, plans, roles, demo)
--
-- Teams on Alembic get all of this from `alembic upgrade head` instead.
--
-- Scope note: almost everything the platform and academic leadership consoles
-- need already exists (plans §4.1, tenants §4.2, subscriptions §4.4,
-- platform_users §4.5, core academic tables §6–7, support_tickets §4.6,
-- audit_logs §10.3). This file adds only genuinely missing integrity/index and
-- governance changes, rather than restating the base tables that own the data.
-- ============================================================================


-- --------------------------------------------------------------------------
-- 1. audit_logs — present in database.sql §10.3, guarded here so a DB built
--    only from migrations also has it. C-SA-07 reads this table; the
--    nullable tenant_id is what makes the "Platform" filter possible
--    (§10.3: "NULL for platform actions").
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id),
  user_id     UUID NOT NULL,
  user_role   VARCHAR(100) NOT NULL,
  action      VARCHAR(100) NOT NULL,
  entity      VARCHAR(100) NOT NULL,
  entity_id   UUID,
  old_value   JSONB,
  new_value   JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_time ON audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity_id   ON audit_logs (entity, entity_id);
-- C-SA-07 lists newest-first across every tenant, which the composite index
-- above cannot serve when tenant_id is not in the predicate.
CREATE INDEX IF NOT EXISTS idx_audit_created_at  ON audit_logs (created_at DESC);


-- --------------------------------------------------------------------------
-- 2. platform_settings — new. Backs C-SA-08 ("Global config: allowed modules
--    list, platform branding").
--
--    Key/value, mirroring tenant_settings (§4.3): the same read/patch code
--    serves both, and adding a setting is an INSERT rather than a migration.
--    Seeded below so a fresh install shows real values; the API also falls
--    back to the same defaults in code, so a missing row is never an error.
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS platform_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         VARCHAR(100) NOT NULL,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_platform_settings_key UNIQUE (key)
);

INSERT INTO platform_settings (key, value)
SELECT v.key, v.value
FROM (VALUES
  ('product_name',      'xyz.com'),
  ('support_email',     'support@xyz.com'),
  ('default_timezone',  'Asia/Kolkata'),
  ('default_currency',  'INR'),
  ('trial_length_days', '14'),
  ('brand_primary',     '#0F172A'),
  ('brand_accent',      '#4F46E5')
) AS v(key, value)
WHERE NOT EXISTS (
  SELECT 1 FROM platform_settings ps WHERE ps.key = v.key
);


-- --------------------------------------------------------------------------
-- 3. modules.price_monthly — schema drift fix.
--
--    Alembic migration 8a1e4b2c5f01 added this column for a-la-carte "Build
--    Your Own" pricing, but database.sql's `modules` table (§5.1) was never
--    updated to match. A DB built from raw SQL therefore has no such column,
--    and every query through the Module ORM fails with UndefinedColumnError —
--    which breaks the plan editor and the settings page module list.
--
--    Caught by the end-to-end run against a real PostgreSQL instance.
-- --------------------------------------------------------------------------

ALTER TABLE modules ADD COLUMN IF NOT EXISTS price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0;


-- --------------------------------------------------------------------------
-- 4. ENUM → VARCHAR for status columns — schema drift fix.
--
--    database.sql types these as PostgreSQL ENUMs (subscription_status,
--    ticket_status, ticket_priority), but every Alembic migration and every
--    SQLAlchemy model types them as VARCHAR(20). asyncpg sends VARCHAR and
--    PostgreSQL refuses to coerce it to an enum:
--
--      DatatypeMismatchError: column "status" is of type subscription_status
--      but expression is of type character varying
--
--    So on a raw-SQL database, creating ANY subscription fails — that breaks
--    self-service signup and Super Admin institution creation alike. The two
--    build paths have to agree; VARCHAR is the one the application code
--    actually uses, and CHECK constraints keep the values honest.
--
--    Caught by the end-to-end run against a real PostgreSQL instance.
-- --------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'status'
      AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE subscriptions ALTER COLUMN status TYPE VARCHAR(20) USING status::TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_tickets' AND column_name = 'status'
      AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE support_tickets ALTER COLUMN status TYPE VARCHAR(20) USING status::TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_tickets' AND column_name = 'priority'
      AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE support_tickets ALTER COLUMN priority TYPE VARCHAR(20) USING priority::TEXT;
  END IF;
END $$;

-- Keep the values valid now that the enum no longer does it.
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS ck_subscriptions_status;
ALTER TABLE subscriptions ADD CONSTRAINT ck_subscriptions_status
  CHECK (status IN ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED'));


-- --------------------------------------------------------------------------
-- 5. Signup / billing tables that exist only in Alembic — schema drift fix.
--
--    Migrations c6bcf3efa755 and 8a1e4b2c5f01 create these eight tables, but
--    database.sql never did. A raw-SQL database is therefore missing the whole
--    billing and self-service-signup layer: platform staff cannot hold a
--    session, no invoice or payment can be recorded, and every transactional
--    email insert fails with UndefinedTableError.
--
--    Definitions below match those migrations column for column, so both
--    build paths produce the same schema.
--
--    Caught by the end-to-end run against a real PostgreSQL instance.
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS platform_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  refresh_token_hash  VARCHAR(255) NOT NULL UNIQUE,
  device_info         TEXT,
  ip_address          INET,
  expires_at          TIMESTAMPTZ NOT NULL,
  revoked_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_platform_sessions_user_id    ON platform_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_platform_sessions_expires_at ON platform_sessions (expires_at);

CREATE TABLE IF NOT EXISTS platform_invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  subscription_id  UUID,
  invoice_number   VARCHAR(50) NOT NULL UNIQUE,
  status           VARCHAR(20) NOT NULL,
  issued_at        DATE NOT NULL,
  due_at           DATE NOT NULL,
  currency         VARCHAR(3) NOT NULL DEFAULT 'INR',
  subtotal         NUMERIC(12,2) NOT NULL,
  tax_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total            NUMERIC(12,2) NOT NULL,
  amount_paid      NUMERIC(12,2) NOT NULL DEFAULT 0,
  gstin            VARCHAR(15),
  place_of_supply  VARCHAR(2),
  pdf_key          TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_platform_invoices_tenant_id ON platform_invoices (tenant_id);

CREATE TABLE IF NOT EXISTS platform_invoice_lines (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   UUID NOT NULL REFERENCES platform_invoices(id) ON DELETE CASCADE,
  description  VARCHAR(500) NOT NULL,
  hsn_sac      VARCHAR(10),
  quantity     NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price   NUMERIC(12,2) NOT NULL,
  tax_rate     NUMERIC(5,2) NOT NULL DEFAULT 0,
  line_total   NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id),
  invoice_id      UUID,
  order_id        UUID,
  status          VARCHAR(20) NOT NULL,
  method          VARCHAR(20) NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  currency        VARCHAR(3) NOT NULL DEFAULT 'INR',
  gateway         VARCHAR(50),
  gateway_ref     VARCHAR(255),
  failure_reason  TEXT,
  received_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_platform_payments_gateway_ref UNIQUE (gateway, gateway_ref)
);
CREATE INDEX IF NOT EXISTS idx_platform_payments_tenant_id ON platform_payments (tenant_id);

CREATE TABLE IF NOT EXISTS coupons (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR(50) NOT NULL UNIQUE,
  discount_type  VARCHAR(10) NOT NULL,
  value          NUMERIC(10,2) NOT NULL,
  currency       VARCHAR(3) NOT NULL DEFAULT 'INR',
  max_uses       INTEGER NOT NULL DEFAULT 0,
  used_count     INTEGER NOT NULL DEFAULT 0,
  valid_from     DATE,
  valid_until    DATE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode              VARCHAR(10) NOT NULL,
  plan_slug         VARCHAR(50) NOT NULL,
  module_keys       VARCHAR(50)[] NOT NULL,
  billing_cycle     VARCHAR(10) NOT NULL DEFAULT 'MONTHLY',
  subtotal          NUMERIC(12,2) NOT NULL,
  discount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  total             NUMERIC(12,2) NOT NULL,
  currency          VARCHAR(3) NOT NULL DEFAULT 'INR',
  coupon_code       VARCHAR(50),
  institution_name  VARCHAR(255) NOT NULL,
  institution_type  VARCHAR(20) NOT NULL,
  contact_email     VARCHAR(255) NOT NULL,
  contact_phone     VARCHAR(20),
  country           VARCHAR(100) NOT NULL DEFAULT 'India',
  state             VARCHAR(100),
  city              VARCHAR(100),
  address           TEXT,
  url_slug          VARCHAR(100) NOT NULL,
  password_hash     TEXT NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  payment_method    VARCHAR(20),
  gateway_ref       VARCHAR(255),
  tenant_id         UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders (status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_contact_email     ON orders (contact_email);

-- Owner-account columns from update.sql §1, applied here too because the
-- table may only now have been created.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS owner_platform_user_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_orders_owner_id ON orders (owner_id);
CREATE INDEX IF NOT EXISTS idx_orders_owner_platform_user_id ON orders (owner_platform_user_id);

CREATE TABLE IF NOT EXISTS outbox_emails (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event       VARCHAR(50) NOT NULL,
  to_address  VARCHAR(255) NOT NULL,
  subject     VARCHAR(255) NOT NULL,
  body        TEXT NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
  attempts    INTEGER NOT NULL DEFAULT 0,
  tenant_id   UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_outbox_emails_status ON outbox_emails (status);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_role  VARCHAR(20) NOT NULL,
  author_id    UUID,
  body         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_id
  ON support_ticket_messages (ticket_id);

-- platform_users gained owner/verification columns in b7e3d2a9c104.
ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT;

-- orders.owner_name — set during provisioning (b7e3d2a9c104).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255);

-- support_tickets: database.sql §10.2 defines a TENANT-scoped ticket
-- (raised_by → users). update.sql §1 introduced the OWNER-scoped ticket the
-- platform dashboard uses. Whichever table exists, these two columns must be
-- present for the SupportTicket model to load, and `owner_id` is what the
-- Super Admin dashboard counts open tickets by.
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'OTHER';
CREATE INDEX IF NOT EXISTS idx_support_tickets_owner_status
  ON support_tickets (owner_id, status);

-- database.sql marks raised_by/description NOT NULL, but an owner-raised
-- ticket has neither (it comes from a platform_owners account, not a tenant
-- user). Relax them so both ticket sources can coexist in one table.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='support_tickets' AND column_name='raised_by'
               AND is_nullable='NO') THEN
    ALTER TABLE support_tickets ALTER COLUMN raised_by DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='support_tickets' AND column_name='description'
               AND is_nullable='NO') THEN
    ALTER TABLE support_tickets ALTER COLUMN description DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='support_tickets' AND column_name='tenant_id'
               AND is_nullable='NO') THEN
    ALTER TABLE support_tickets ALTER COLUMN tenant_id DROP NOT NULL;
  END IF;
END $$;


-- --------------------------------------------------------------------------
-- 6. tenants.owner_id — added by update.sql §1, repeated here only as the
--    guard for DBs that skipped it, because the Super Admin institution list
--    joins it to show the owning account.
-- --------------------------------------------------------------------------

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_id UUID;
CREATE INDEX IF NOT EXISTS idx_tenants_owner_id ON tenants (owner_id);


-- --------------------------------------------------------------------------
-- 7. Indexes for the console's hot paths.
--
--    C-SA-02 filters tenants by plan and by active flag; C-SA-01 sums the
--    newest subscription per tenant; C-SA-06 lists platform_users by role.
--    Without these the console does a seq scan per page load once the tenant
--    table grows past a few thousand rows.
-- --------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_tenants_plan_id           ON tenants (plan_id);
CREATE INDEX IF NOT EXISTS idx_tenants_is_active         ON tenants (is_active);
CREATE INDEX IF NOT EXISTS idx_tenants_created_at        ON tenants (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_created
  ON subscriptions (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status      ON subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_platform_users_role       ON platform_users (platform_role);


-- --------------------------------------------------------------------------
-- 8. Support Staff console (C-SP-01 … C-SP-04).
--
--    `support_tickets` exists twice in this repo with different shapes:
--      · database.sql §10.2 — institution-raised (raised_by → users,
--        tenant_id NOT NULL, assigned_to, description, resolved_at)
--      · update.sql §1      — owner-raised   (owner_id → platform_owners,
--        category, tenant_id nullable)
--    Whichever ran, the table is missing half of what the other defines, and
--    the Support console needs the union: C-SP-02 says "All tickets", so one
--    queue must show both an owner's billing question and an institution
--    admin's bug report.
--
--    Columns are added rather than a second table created, because two ticket
--    tables would mean two queues, two SLA clocks and two reply threads for
--    what is one support conversation.
-- --------------------------------------------------------------------------

-- Union of both definitions. All nullable: a ticket has EITHER an owner_id
-- (raised from the platform dashboard) OR a raised_by (raised inside a
-- tenant), never both.
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS owner_id     UUID;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS tenant_id    UUID REFERENCES tenants(id);
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS raised_by    UUID REFERENCES users(id);
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS assigned_to  UUID REFERENCES platform_users(id);
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS description  TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS category     VARCHAR(50) NOT NULL DEFAULT 'OTHER';
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS resolved_at  TIMESTAMPTZ;

-- Human reference (TKT-1042) shown in every Support screen. Generated from a
-- sequence rather than count(*)+1, which races under concurrent inserts —
-- the same rule invoice numbering follows (SYSTEM-FLOW §9).
CREATE SEQUENCE IF NOT EXISTS support_ticket_reference_seq START 1001;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS reference VARCHAR(20);

UPDATE support_tickets
   SET reference = 'TKT-' || nextval('support_ticket_reference_seq')
 WHERE reference IS NULL;

ALTER TABLE support_tickets
  ALTER COLUMN reference SET DEFAULT 'TKT-' || nextval('support_ticket_reference_seq');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_support_tickets_reference'
  ) THEN
    ALTER TABLE support_tickets
      ADD CONSTRAINT uq_support_tickets_reference UNIQUE (reference);
  END IF;
END $$;

-- Relax database.sql's NOT NULLs: an owner-raised ticket has no raised_by,
-- no tenant and (until the first message) no description.
DO $$
DECLARE col TEXT;
BEGIN
  FOREACH col IN ARRAY ARRAY['raised_by', 'description', 'tenant_id'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'support_tickets' AND column_name = col
        AND is_nullable = 'NO'
    ) THEN
      EXECUTE format('ALTER TABLE support_tickets ALTER COLUMN %I DROP NOT NULL', col);
    END IF;
  END LOOP;
END $$;

-- Every ticket must be attributable to someone.
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS ck_support_tickets_raiser;
ALTER TABLE support_tickets ADD CONSTRAINT ck_support_tickets_raiser
  CHECK (owner_id IS NOT NULL OR raised_by IS NOT NULL);

-- ── Priority: settle on database.sql §10.2 / types/support.ts ─────────────
-- The ORM shipped LOW/NORMAL/HIGH/URGENT while the DB enum and the whole
-- frontend use LOW/MEDIUM/HIGH/CRITICAL. Existing rows are migrated so no
-- ticket is left with a value the UI cannot render.
UPDATE support_tickets SET priority = 'MEDIUM'   WHERE priority = 'NORMAL';
UPDATE support_tickets SET priority = 'CRITICAL' WHERE priority = 'URGENT';
ALTER TABLE support_tickets ALTER COLUMN priority SET DEFAULT 'MEDIUM';

ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS ck_support_tickets_priority;
ALTER TABLE support_tickets ADD CONSTRAINT ck_support_tickets_priority
  CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));

ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS ck_support_tickets_status;
ALTER TABLE support_tickets ADD CONSTRAINT ck_support_tickets_status
  CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'));

-- ── Reply thread ──────────────────────────────────────────────────────────
-- `support_ticket_messages` (update.sql §1) is the thread C-SP-03 renders.
-- It needs one more column: an internal note is visible to platform staff
-- only and must never reach the institution. Explicit, so the UI cannot leak
-- one by accident.
ALTER TABLE support_ticket_messages
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT FALSE;

-- Support agents are platform staff, so a reply can come from SUPPORT too.
ALTER TABLE support_ticket_messages DROP CONSTRAINT IF EXISTS ck_ticket_messages_author;
ALTER TABLE support_ticket_messages ADD CONSTRAINT ck_ticket_messages_author
  CHECK (author_role IN ('OWNER', 'STAFF', 'SUPPORT', 'INSTITUTION'));

-- ── Indexes for the Support queue ─────────────────────────────────────────
-- C-SP-01 counts by status and by assignee; C-SP-02 filters by status,
-- priority and institution; C-SP-04 lists one tenant's open tickets.
CREATE INDEX IF NOT EXISTS idx_support_tickets_status      ON support_tickets (status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority    ON support_tickets (priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets (assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at  ON support_tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant_status
  ON support_tickets (tenant_id, status);


-- --------------------------------------------------------------------------
-- 9. Principal academic-governance workflow (C-PR-01 … C-PR-10).
--
-- The base schema already owns attendance, exams, results, notices, people
-- and timetables.  What it did *not* represent was the two-person control
-- required by role_based_system_design.md §4.3 / §6:
--
--   Exam Controller prepares a schedule     → Principal approves or rejects
--   Exam Controller compiles results        → Principal approves or rejects
--   Exam Controller publishes an approved result
--
-- A boolean is not enough: rejected is materially different from pending and
-- the decision needs an actor, timestamp and an auditable rationale.  These
-- columns are additive, default legacy rows deterministically, and every
-- constraint/index is idempotent for safe production re-runs.
-- --------------------------------------------------------------------------

-- ── Exam schedule approval ─────────────────────────────────────────────────
ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS schedule_approval_status VARCHAR(20);
ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS schedule_approved_by UUID REFERENCES users(id);
ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS schedule_approved_at TIMESTAMPTZ;
ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS schedule_approval_note TEXT;

-- Existing future schedules have never been reviewed; do not silently grant
-- approval during rollout. Historical completed rows are marked approved;
-- cancelled rows are terminally rejected rather than left in the queue.
UPDATE exams
   SET schedule_approval_status = CASE
     WHEN status IN ('ONGOING', 'COMPLETED', 'RESULTS_RELEASED') THEN 'APPROVED'
     WHEN status = 'CANCELLED' THEN 'REJECTED'
     ELSE 'PENDING'
   END
 WHERE schedule_approval_status IS NULL;

ALTER TABLE exams
  ALTER COLUMN schedule_approval_status SET DEFAULT 'PENDING';
ALTER TABLE exams
  ALTER COLUMN schedule_approval_status SET NOT NULL;

ALTER TABLE exams DROP CONSTRAINT IF EXISTS ck_exams_schedule_approval_status;
ALTER TABLE exams ADD CONSTRAINT ck_exams_schedule_approval_status
  CHECK (schedule_approval_status IN ('PENDING', 'APPROVED', 'REJECTED'));

CREATE INDEX IF NOT EXISTS idx_exams_tenant_schedule_approval
  ON exams (tenant_id, schedule_approval_status, scheduled_at);

-- ── Result-publication approval ────────────────────────────────────────────
ALTER TABLE result_publications
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20);
ALTER TABLE result_publications
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE result_publications
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE result_publications
  ADD COLUMN IF NOT EXISTS approval_note TEXT;

-- A publication already visible to students must have passed governance before
-- this feature existed; unpublished legacy rows enter the explicit queue.
UPDATE result_publications
   SET approval_status = CASE
     WHEN is_visible_to_students THEN 'APPROVED'
     ELSE 'PENDING'
   END
 WHERE approval_status IS NULL;

ALTER TABLE result_publications
  ALTER COLUMN approval_status SET DEFAULT 'PENDING';
ALTER TABLE result_publications
  ALTER COLUMN approval_status SET NOT NULL;

ALTER TABLE result_publications DROP CONSTRAINT IF EXISTS ck_result_publications_approval_status;
ALTER TABLE result_publications ADD CONSTRAINT ck_result_publications_approval_status
  CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED'));

CREATE INDEX IF NOT EXISTS idx_result_publications_tenant_approval
  ON result_publications (tenant_id, approval_status, published_at DESC);


-- --------------------------------------------------------------------------
-- 10. HOD mentor integrity (C-HD-08).
--
-- `mentor_assignments` already belongs to the base schema, but its original
-- unique key is (mentor_id, student_id, academic_year_id). That permits the
-- same student to have two *active* mentors in one year, which contradicts the
-- HOD workflow and makes a reassignment race-prone. Keep history by allowing
-- inactive rows, while the partial unique index guarantees one active mentor.
-- --------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM mentor_assignments
    WHERE is_active = TRUE
    GROUP BY tenant_id, student_id, academic_year_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce one active mentor per student/year: resolve duplicate active mentor_assignments first';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mentor_assignments__tenant_student_year_active
  ON mentor_assignments (tenant_id, student_id, academic_year_id)
  WHERE is_active = TRUE;


-- --------------------------------------------------------------------------
-- 11. HOD scope bootstrap (C-HD-01 … C-HD-12).
--
-- Older department setup writes `departments.hod_id` but may predate the
-- matching department-scoped HOD role assignment. The production HOD API is
-- fail-closed, so reconcile the two canonical links once during rollout.
-- Future department updates perform the same operation in the application.
-- --------------------------------------------------------------------------

UPDATE role_assignments ra
   SET is_active = TRUE,
       scope_type = 'DEPARTMENT',
       expires_at = NULL
  FROM roles r, departments d
 WHERE d.hod_id = ra.user_id
   AND r.id = ra.role_id
   AND r.name = 'HOD'
   AND ra.tenant_id = d.tenant_id
   AND ra.scope_id = d.id
   AND d.hod_id IS NOT NULL;

INSERT INTO role_assignments (
  id, user_id, role_id, tenant_id, scope_id, scope_type, assigned_at, is_active
)
SELECT gen_random_uuid(), d.hod_id, r.id, d.tenant_id, d.id, 'DEPARTMENT', NOW(), TRUE
  FROM departments d
  JOIN roles r ON r.name = 'HOD'
 WHERE d.hod_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM role_assignments ra
      WHERE ra.user_id = d.hod_id
        AND ra.role_id = r.id
        AND ra.tenant_id = d.tenant_id
        AND ra.scope_id = d.id
   );


-- --------------------------------------------------------------------------
-- 12. Academic Coordinator console (C-AC-01 … C-AC-08).
--
-- The base schema already owns the timetable, the substitution log, the
-- academic calendar and the notice board. §4.5 grants the coordinator a
-- build grant on the timetable and the only ``canSubstitute`` permission;
-- nothing in §7.4 had to change.
--
-- What this section adds is a small set of hot-path indexes the C-AC
-- service filters on, plus the role grant reconciliation that older
-- institutions may not have completed during the HOD bootstrap.  A DB
-- built only from database.sql + update.sql therefore gets every index the
-- production service requires.
-- --------------------------------------------------------------------------

-- Substitutions — the C-AC-05 board filters by tenant + date and the
-- C-AC-06 form needs (slot_id, date) lookups for the unique-key check.
CREATE INDEX IF NOT EXISTS idx_timetable_substitutions_tenant_id
  ON timetable_substitutions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_timetable_substitutions_date
  ON timetable_substitutions (tenant_id, date);

-- Academic events — the C-AC-07 calendar lists everything between
-- from_date and to_date; the tenant + year composite serves the dashboard's
-- "next 14 days" rollup, and a holiday flag index keeps the legend
-- response time bounded.
CREATE INDEX IF NOT EXISTS idx_academic_events_tenant_year
  ON academic_events (tenant_id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_academic_events_dates
  ON academic_events (tenant_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_academic_events_is_holiday
  ON academic_events (tenant_id, is_holiday, start_date)
  WHERE is_holiday = TRUE;

-- The base schema defines the ACADEMIC_COORDINATOR role in §5.6 but older
-- tenants may not have an active role assignment for their coordinator
-- user.  The HOD bootstrap in section 11 has the same shape — reconcile
-- the canonical link once during rollout so the role check never has to
-- probe for the role row at request time.
INSERT INTO role_assignments (
  id, user_id, role_id, tenant_id, scope_type, assigned_at, is_active
)
SELECT gen_random_uuid(), u.id, r.id, u.tenant_id, 'INSTITUTION', NOW(), TRUE
  FROM users u
  JOIN roles r ON r.name = 'ACADEMIC_COORDINATOR'
 WHERE u.deleted_at IS NULL
   AND u.is_active IS TRUE
   AND NOT EXISTS (
     SELECT 1
       FROM role_assignments ra
      WHERE ra.user_id = u.id
        AND ra.role_id = r.id
        AND ra.tenant_id = u.tenant_id
   );


-- --------------------------------------------------------------------------
-- 13. Exam Controller console (C-EC-01 … C-EC-10).
--
-- The exam module's canonical tables already belong to the base schema
-- (§7.2 ``exams``, ``exam_hall_allocations``, ``exam_attempts``,
-- ``malpractice_logs``, ``result_publications``, ``student_results``).  The
-- controller service is institution-wide, so no department fence is
-- applied; every filter hits ``tenant_id`` directly.
--
-- What this section adds:
--
--   1. The two new tables the controller console introduces:
--      * ``exam_controller_publications`` — the controller's draft bundle
--        before it is forwarded to the principal approval queue.
--      * ``exam_controller_grade_cards`` — per-student grade cards
--        generated for a publication.
--   2. The composite indexes the C-EC service hot paths require.
--   3. The role grant reconciliation for tenants whose ``EXAM_CONTROLLER``
--      user does not yet have an active role assignment.
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS exam_controller_publications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title               VARCHAR(255) NOT NULL,
  academic_year_id    UUID NOT NULL REFERENCES academic_years(id),
  class_id            UUID REFERENCES classes(id),
  exam_ids            UUID[] NOT NULL DEFAULT '{}',
  compiled_by         UUID NOT NULL REFERENCES users(id),
  compiled_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at        TIMESTAMPTZ,
  status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  summary             JSONB NOT NULL DEFAULT '{}'::jsonb,
  note                TEXT
);

CREATE INDEX IF NOT EXISTS idx_ec_publications_tenant_year
  ON exam_controller_publications (tenant_id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_ec_publications_status
  ON exam_controller_publications (tenant_id, status);

DO $$ BEGIN
  CREATE TYPE exam_controller_publication_status AS ENUM (
    'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'WITHDRAWN'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE exam_controller_publications
  ALTER COLUMN status TYPE exam_controller_publication_status
  USING status::exam_controller_publication_status;

CREATE TABLE IF NOT EXISTS exam_controller_grade_cards (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  publication_id          UUID NOT NULL REFERENCES exam_controller_publications(id) ON DELETE CASCADE,
  student_id              UUID NOT NULL REFERENCES users(id),
  class_id                UUID NOT NULL REFERENCES classes(id),
  total_marks_obtained    NUMERIC(8, 2) NOT NULL,
  total_marks_possible    NUMERIC(8, 2) NOT NULL,
  percentage              NUMERIC(5, 2) NOT NULL,
  grade                   VARCHAR(5) NOT NULL,
  rank                    INTEGER,
  subject_scores          JSONB NOT NULL DEFAULT '[]'::jsonb,
  status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  generated_at            TIMESTAMPTZ,
  published_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ec_grade_cards_publication
  ON exam_controller_grade_cards (publication_id);
CREATE INDEX IF NOT EXISTS idx_ec_grade_cards_tenant_class
  ON exam_controller_grade_cards (tenant_id, class_id);

DO $$ BEGIN
  CREATE TYPE exam_controller_grade_card_status AS ENUM (
    'PENDING', 'GENERATED', 'PUBLISHED', 'FAILED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE exam_controller_grade_cards
  ALTER COLUMN status TYPE exam_controller_grade_card_status
  USING status::exam_controller_grade_card_status;

-- The Exam Controller dashboard and schedule pages filter on (tenant_id,
-- status) and (tenant_id, scheduled_at).  The base schema already indexes
-- both, so this section only adds the publication-grade-card composite
-- index that the C-EC-09 page relies on.
CREATE INDEX IF NOT EXISTS idx_grade_cards_tenant_pub
  ON exam_controller_grade_cards (tenant_id, publication_id);

-- The base schema defines the EXAM_CONTROLLER role in §5.6 but older
-- tenants may not have an active role assignment for their controller
-- user.  Reconcile the canonical link once during rollout so the role
-- check never has to probe for the role row at request time.
INSERT INTO role_assignments (
  id, user_id, role_id, tenant_id, scope_type, assigned_at, is_active
)
SELECT gen_random_uuid(), u.id, r.id, u.tenant_id, 'INSTITUTION', NOW(), TRUE
  FROM users u
  JOIN roles r ON r.name = 'EXAM_CONTROLLER'
 WHERE u.deleted_at IS NULL
   AND u.is_active IS TRUE
   AND NOT EXISTS (
     SELECT 1
       FROM role_assignments ra
      WHERE ra.user_id = u.id
        AND ra.role_id = r.id
        AND ra.tenant_id = u.tenant_id
   );
