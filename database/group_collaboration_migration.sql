-- ============================================================================
-- Migration: Project Group Collaboration & Workspace Facilities
-- Creates project_group_tasks, project_group_messages, project_group_resources
-- ============================================================================

-- 1. Create project_group_tasks table (To-Do & Task Distribution)
CREATE TABLE IF NOT EXISTS project_group_tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  group_id         UUID NOT NULL REFERENCES project_groups(id) ON DELETE CASCADE,
  title            VARCHAR(255) NOT NULL,
  description      TEXT,
  assigned_to      UUID REFERENCES users(id) ON DELETE SET NULL,
  status           VARCHAR(30) NOT NULL DEFAULT 'TODO', -- 'TODO', 'IN_PROGRESS', 'DONE'
  due_date         TIMESTAMPTZ,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create project_group_messages table (Team Discussion / Coordination)
CREATE TABLE IF NOT EXISTS project_group_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  group_id         UUID NOT NULL REFERENCES project_groups(id) ON DELETE CASCADE,
  sender_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message          TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create project_group_resources table (Shared Repos, Docs, Drive links)
CREATE TABLE IF NOT EXISTS project_group_resources (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  group_id         UUID NOT NULL REFERENCES project_groups(id) ON DELETE CASCADE,
  title            VARCHAR(255) NOT NULL,
  url              TEXT NOT NULL,
  resource_type    VARCHAR(50) NOT NULL DEFAULT 'LINK', -- 'LINK', 'REPO', 'DOC', 'DRIVE'
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Indexes for fast query lookup
CREATE INDEX IF NOT EXISTS idx_project_group_tasks_group ON project_group_tasks (group_id);
CREATE INDEX IF NOT EXISTS idx_project_group_tasks_tenant ON project_group_tasks (tenant_id);
CREATE INDEX IF NOT EXISTS idx_project_group_tasks_assigned ON project_group_tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_project_group_messages_group ON project_group_messages (group_id, created_at);
CREATE INDEX IF NOT EXISTS idx_project_group_resources_group ON project_group_resources (group_id);
