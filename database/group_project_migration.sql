-- ============================================================================
-- Migration: Group Project / Assignment Support
-- Creates project_groups, project_group_members and adds group columns
-- ============================================================================

-- 1. Add group size configuration columns to assignments table
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS min_group_size INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS max_group_size INTEGER NOT NULL DEFAULT 6;

-- 2. Create project_groups table
CREATE TABLE IF NOT EXISTS project_groups (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assignment_id    UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  name             VARCHAR(100) NOT NULL,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_project_groups__assignment_name UNIQUE (assignment_id, name)
);

-- 3. Create project_group_members table
CREATE TABLE IF NOT EXISTS project_group_members (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  group_id         UUID NOT NULL REFERENCES project_groups(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_project_group_members__group_student UNIQUE (group_id, student_id)
);

-- 4. Add group_id to submissions table for group-wide submissions
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES project_groups(id) ON DELETE SET NULL;

-- 5. Indexes for fast query lookup
CREATE INDEX IF NOT EXISTS idx_project_groups_assignment ON project_groups (assignment_id);
CREATE INDEX IF NOT EXISTS idx_project_groups_tenant ON project_groups (tenant_id);
CREATE INDEX IF NOT EXISTS idx_project_group_members_group ON project_group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_project_group_members_student ON project_group_members (student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_group ON submissions (group_id);
