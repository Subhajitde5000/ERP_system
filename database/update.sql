-- ============================================================================
-- update.sql — production database updates (apply after database.sql)
-- ============================================================================
-- This file captures schema changes made AFTER the original database.sql that
-- are needed for the platform to run. Each block is idempotent (safe to re-run)
-- and is mirrored by an Alembic migration in backend/app/alembic/versions.
--
-- Apply order on a fresh DB:
--   1. psql -f database/database.sql        (the 106-table base schema + seeds)
--   2. psql -f database/update.sql          (this file)
--   3. python backend/scripts/seed_data.py  (catalogue, plans, roles, demo tenant)
--
-- In an Alembic-managed deployment, `alembic upgrade head` performs both #2's
-- changes and the owner-account additions; this SQL is the equivalent for teams
-- that apply raw SQL.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Platform owner (customer) accounts — one account owns many institutions.
--    Migration: e2a3f5b7c8d0_platform_owners.py
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS platform_owners (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        VARCHAR(255) NOT NULL,
  email                       VARCHAR(255) NOT NULL,
  password_hash               VARCHAR(255) NOT NULL,
  is_email_verified           BOOLEAN NOT NULL DEFAULT FALSE,
  email_verification_token    VARCHAR(255),
  email_verification_expires  TIMESTAMPTZ,
  password_reset_token        VARCHAR(255),
  password_reset_expires      TIMESTAMPTZ,
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at               TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_platform_owners_email UNIQUE (email)
);
CREATE INDEX IF NOT EXISTS idx_platform_owners_email ON platform_owners (email);

CREATE TABLE IF NOT EXISTS owner_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            UUID NOT NULL REFERENCES platform_owners(id) ON DELETE CASCADE,
  refresh_token_hash  VARCHAR(255) NOT NULL,
  device_info         TEXT,
  ip_address          INET,
  expires_at          TIMESTAMPTZ NOT NULL,
  revoked_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_owner_sessions_refresh_token_hash UNIQUE (refresh_token_hash)
);
CREATE INDEX IF NOT EXISTS idx_owner_sessions_owner_id ON owner_sessions (owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_sessions_expires_at ON owner_sessions (expires_at);

-- Support tickets raised by an owner from their platform dashboard.
CREATE TABLE IF NOT EXISTS support_tickets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES platform_owners(id) ON DELETE CASCADE,
  tenant_id   UUID REFERENCES tenants(id),
  subject     VARCHAR(255) NOT NULL,
  category    VARCHAR(50) NOT NULL DEFAULT 'OTHER',
  status      VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  priority    VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_owner_status ON support_tickets (owner_id, status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant_id ON support_tickets (tenant_id);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_role  VARCHAR(20) NOT NULL,
  author_id    UUID,
  body         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_id ON support_ticket_messages (ticket_id);

-- Link institutions + orders to their owner (one owner → many institutions).
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_id UUID;
CREATE INDEX IF NOT EXISTS idx_tenants_owner_id ON tenants (owner_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS owner_id UUID;
CREATE INDEX IF NOT EXISTS idx_orders_owner_id ON orders (owner_id);

-- --------------------------------------------------------------------------
-- 2. Academic link tables — enroll a student into a class, assign a teacher
--    to a subject. Migration: f3b4c6d8e9a1_institution_academic_links.py
--    (These already exist in database.sql §6.5–6.6; included here so a DB
--    built only from migrations also has them.)
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS student_enrollments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  student_id        UUID NOT NULL REFERENCES users(id),
  class_id          UUID NOT NULL REFERENCES classes(id),
  academic_year_id  UUID NOT NULL REFERENCES academic_years(id),
  roll_number       VARCHAR(50),
  enrollment_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  status            VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  transferred_to    UUID REFERENCES classes(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_student_enrollments__student_id_class_id_academic_year_id
    UNIQUE (student_id, class_id, academic_year_id)
);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_tenant_id ON student_enrollments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_class_id ON student_enrollments (class_id);

CREATE TABLE IF NOT EXISTS teacher_subjects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  teacher_id        UUID NOT NULL REFERENCES users(id),
  subject_id        UUID NOT NULL REFERENCES subjects(id),
  role_in_subject   VARCHAR(50) NOT NULL DEFAULT 'TEACHER',
  assigned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by       UUID REFERENCES users(id),
  CONSTRAINT uq_teacher_subjects__teacher_id_subject_id_role_in_subject
    UNIQUE (teacher_id, subject_id, role_in_subject)
);
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_tenant_id ON teacher_subjects (tenant_id);
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_subject_id ON teacher_subjects (subject_id);

-- --------------------------------------------------------------------------
-- 3. Seed guard — make sure the institution-admin RBAC roles exist when the DB
--    is built via migrations (database.sql already inserts these). Safe to run
--    because of the NOT EXISTS guard.
-- --------------------------------------------------------------------------

INSERT INTO roles (name, label, scope_level, is_platform, is_optional, module_key, description)
SELECT 'INSTITUTION_ADMIN', 'Institution Admin', 'INSTITUTION', FALSE, FALSE, NULL,
       'Full control of one institution: structure, users, roles, settings.'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'INSTITUTION_ADMIN');

INSERT INTO roles (name, label, scope_level, is_platform, is_optional, module_key, description)
SELECT 'STUDENT', 'Student', 'SELF', FALSE, FALSE, NULL,
       'Own attendance, exams, assignments, results and fees.'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'STUDENT');
