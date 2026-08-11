-- Active: 1785483683689@@127.0.0.1@5432@erp_system
-- =============================================================================
-- Migration: Add Question Bank / Question Library Feature
-- Description: Creates table question_bank_items and links questions.bank_item_id
--              for reusable exam questions.
-- =============================================================================

-- 1. Create table question_bank_items
CREATE TABLE IF NOT EXISTS question_bank_items (
    id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_by                   UUID REFERENCES users(id) ON DELETE SET NULL,
    subject_id                   UUID REFERENCES subjects(id) ON DELETE SET NULL,
    class_id                     UUID REFERENCES classes(id) ON DELETE SET NULL,
    text                         TEXT NOT NULL,
    rich_text                    JSONB,
    question_type                question_type NOT NULL,
    default_marks                NUMERIC(5,2) NOT NULL DEFAULT 1.00,
    negative_marks               NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    options                      JSONB NOT NULL DEFAULT '[]'::jsonb,
    image_url                    TEXT,
    explanation                  TEXT,
    difficulty                   difficulty_level,
    tags                         JSONB DEFAULT '[]'::jsonb,
    usage_count                  INTEGER NOT NULL DEFAULT 1,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add performance indexes for Question Bank queries
CREATE INDEX IF NOT EXISTS idx_qbank_tenant_subject ON question_bank_items (tenant_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_qbank_created_by ON question_bank_items (tenant_id, created_by);
CREATE INDEX IF NOT EXISTS idx_qbank_type_diff ON question_bank_items (tenant_id, question_type, difficulty);

-- 3. Add bank_item_id reference column to questions table
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS bank_item_id UUID REFERENCES question_bank_items(id) ON DELETE SET NULL;

-- 4. Add index for questions.bank_item_id
CREATE INDEX IF NOT EXISTS idx_questions_bank_item_id ON questions (bank_item_id);

-- Documentation Comments
COMMENT ON TABLE question_bank_items IS 'Master repository of reusable examination questions per institution/tenant.';
COMMENT ON COLUMN questions.bank_item_id IS 'Optional reference to the master question bank item from which this exam question was saved or imported.';
