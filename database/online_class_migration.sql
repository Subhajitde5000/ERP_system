-- ============================================================================
--  Online Class module — live classes with automatic attendance.
--
--  Apply once to an existing database:
--      psql -U erp_user -d erp_db -f database/online_class_migration.sql
--
--  The main schema (database/database.sql) already contains the same final
--  definitions, so a fresh install does not need this file.
-- ============================================================================

-- ── Enum types ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE online_class_status AS ENUM ('SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE online_class_mode AS ENUM ('SCHEDULED', 'INSTANT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE online_attendance_status AS ENUM ('PRESENT', 'LATE', 'ABSENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS online_classes (

  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  teacher_id                   UUID NOT NULL REFERENCES users(id),
  class_id                     UUID NOT NULL REFERENCES classes(id),
  subject_id                   UUID NOT NULL REFERENCES subjects(id),
  timetable_slot_id            UUID REFERENCES timetable_slots(id) ON DELETE SET NULL,
  topic                        VARCHAR(255) NOT NULL,
  mode                         online_class_mode NOT NULL DEFAULT 'SCHEDULED',
  status                       online_class_status NOT NULL DEFAULT 'SCHEDULED',
  scheduled_at                 TIMESTAMPTZ,
  duration_minutes             INTEGER NOT NULL DEFAULT 60,
  allow_join                   BOOLEAN NOT NULL DEFAULT TRUE,
  recording_enabled            BOOLEAN NOT NULL DEFAULT FALSE,
  recording_url                TEXT,
  started_at                   TIMESTAMPTZ,
  ended_at                     TIMESTAMPTZ,
  attendance_session_id        UUID REFERENCES attendance_sessions(id) ON DELETE SET NULL,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS online_class_participants (

  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  class_id                     UUID NOT NULL REFERENCES online_classes(id) ON DELETE CASCADE,
  student_id                   UUID NOT NULL REFERENCES users(id),
  waiting_since                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at                    TIMESTAMPTZ,
  left_at                      TIMESTAMPTZ,
  duration_seconds             INTEGER NOT NULL DEFAULT 0,
  attendance_status            online_attendance_status,
  hand_raised_at               TIMESTAMPTZ,
  is_online                    BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT uq_online_class_participants__class_id_student_id UNIQUE (class_id, student_id)
);

CREATE TABLE IF NOT EXISTS online_class_messages (

  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  class_id                     UUID NOT NULL REFERENCES online_classes(id) ON DELETE CASCADE,
  sender_id                    UUID NOT NULL REFERENCES users(id),
  sender_role                  VARCHAR(20) NOT NULL,
  body                         TEXT NOT NULL,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS online_class_files (

  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  class_id                     UUID NOT NULL REFERENCES online_classes(id) ON DELETE CASCADE,
  uploader_id                  UUID NOT NULL REFERENCES users(id),
  file_name                    VARCHAR(255) NOT NULL,
  file_path                    TEXT NOT NULL,
  file_size_bytes              BIGINT NOT NULL DEFAULT 0,
  mime_type                    VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream',
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_online_classes_tenant_status ON online_classes (tenant_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_online_classes_teacher ON online_classes (teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_online_classes_class ON online_classes (class_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_online_class_participants_class ON online_class_participants (class_id);
CREATE INDEX IF NOT EXISTS idx_online_class_participants_student ON online_class_participants (student_id);
CREATE INDEX IF NOT EXISTS idx_online_class_messages_class ON online_class_messages (class_id, created_at);
CREATE INDEX IF NOT EXISTS idx_online_class_files_class ON online_class_files (class_id, created_at);
