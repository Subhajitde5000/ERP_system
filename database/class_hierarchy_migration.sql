-- ─────────────────────────────────────────────────────────────────────────────
-- CLASS HIERARCHY MIGRATION
-- Adds the full School / College academic group hierarchy without breaking
-- any existing FK references on `classes`.
--
-- School:  AcademicYear → class_grades (grade+stream) → classes (section = Academic Group)
-- College: AcademicYear → departments → class_programs (program+semester) → classes (batch = Academic Group)
--
-- The `classes` table stays the final Academic Group referenced by subjects,
-- enrollments, attendance, exams, and the timetable — nothing downstream changes.
-- ─────────────────────────────────────────────────────────────────────────────

-- §1 — School grade groups
-- One row per (tenant, year, grade_number, stream).
-- E.g.  tenant=X, year=2026-27, grade_number=11, stream='Science'
CREATE TABLE IF NOT EXISTS class_grades (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  academic_year_id UUID        NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name             VARCHAR(100) NOT NULL,     -- "Class 11"
  grade_number     INTEGER     NOT NULL CHECK (grade_number BETWEEN 1 AND 12),
  stream           VARCHAR(50),               -- NULL | 'Science' | 'Commerce' | 'Arts' | custom
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_class_grades UNIQUE (tenant_id, academic_year_id, grade_number, stream)
);

CREATE INDEX IF NOT EXISTS idx_class_grades_tenant_id        ON class_grades (tenant_id);
CREATE INDEX IF NOT EXISTS idx_class_grades_academic_year_id ON class_grades (academic_year_id);

-- §2 — College program + semester groups
-- One row per (tenant, dept, program_code, semester_number, year).
-- E.g.  dept=CSE, program_code=BTCSE, semester_number=3, year=2026-27
CREATE TABLE IF NOT EXISTS class_programs (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  department_id    UUID         NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  academic_year_id UUID         NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  program_name     VARCHAR(200) NOT NULL,    -- "B.Tech CSE"
  program_code     VARCHAR(30)  NOT NULL,    -- "BTCSE"
  semester_number  INTEGER      NOT NULL CHECK (semester_number >= 1),
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_class_programs UNIQUE (tenant_id, department_id, program_code, semester_number, academic_year_id)
);

CREATE INDEX IF NOT EXISTS idx_class_programs_tenant_id        ON class_programs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_class_programs_department_id    ON class_programs (department_id);
CREATE INDEX IF NOT EXISTS idx_class_programs_academic_year_id ON class_programs (academic_year_id);

-- §3 — Extend the existing `classes` table (Academic Group rows)
-- grade_id   → set for school sections (FK to class_grades)
-- program_id → set for college batches (FK to class_programs)
-- section_label → "A", "B", "Batch A" etc. (display label for the section)
ALTER TABLE classes ADD COLUMN IF NOT EXISTS grade_id      UUID REFERENCES class_grades(id)   ON DELETE SET NULL;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS program_id    UUID REFERENCES class_programs(id)  ON DELETE SET NULL;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS section_label VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_classes_grade_id   ON classes (grade_id)   WHERE grade_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_classes_program_id ON classes (program_id) WHERE program_id IS NOT NULL;

-- §4 — Grant access permissions to public / current role so backend application user has access
GRANT ALL PRIVILEGES ON TABLE class_grades TO PUBLIC;
GRANT ALL PRIVILEGES ON TABLE class_programs TO PUBLIC;

