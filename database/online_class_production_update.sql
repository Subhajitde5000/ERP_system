-- =============================================================================
-- online_class_production_update.sql
-- Incremental update for existing deployments.
-- Run ONCE against an existing database (already has the online_classes tables
-- from online_class_migration.sql). Safe to re-run (all statements are
-- idempotent via IF NOT EXISTS / DO $$ BEGIN … EXCEPTION patterns).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add whiteboard_strokes column to online_classes
-- ---------------------------------------------------------------------------
ALTER TABLE online_classes
    ADD COLUMN IF NOT EXISTS whiteboard_strokes JSONB NOT NULL DEFAULT '[]';

-- ---------------------------------------------------------------------------
-- 2. Add uploader_role column to online_class_files
--    (enables student file sharing — defaults to 'TEACHER' for existing rows)
-- ---------------------------------------------------------------------------
ALTER TABLE online_class_files
    ADD COLUMN IF NOT EXISTS uploader_role VARCHAR(20) NOT NULL DEFAULT 'TEACHER';

-- ---------------------------------------------------------------------------
-- 3. Create online_class_muted_students table (chat mute list)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS online_class_muted_students (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    class_id    UUID        NOT NULL REFERENCES online_classes(id) ON DELETE CASCADE,
    student_id  UUID        NOT NULL REFERENCES users(id),
    muted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_muted__class_student UNIQUE (class_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_muted_class ON online_class_muted_students (class_id);

-- ---------------------------------------------------------------------------
-- 4. Index on notifications for student inbox performance
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notif_user_unread
    ON notifications (user_id, is_read, created_at);
