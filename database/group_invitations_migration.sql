-- ============================================================================
-- Migration: Project Group Invitations (Leader Invite Teammates Feature)
-- Creates project_group_invitations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_group_invitations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  group_id         UUID NOT NULL REFERENCES project_groups(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status           VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at     TIMESTAMPTZ
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_project_group_invitations_group ON project_group_invitations (group_id);
CREATE INDEX IF NOT EXISTS idx_project_group_invitations_student ON project_group_invitations (student_id);
CREATE INDEX IF NOT EXISTS idx_project_group_invitations_tenant ON project_group_invitations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_project_group_invitations_status ON project_group_invitations (student_id, status);
