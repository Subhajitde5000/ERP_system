-- Add notice-board image, document and external-link attachment support to an
-- existing database. The main schema contains the same final definition.
ALTER TABLE notice_attachments
  ALTER COLUMN file_key DROP NOT NULL,
  ALTER COLUMN file_size_bytes SET DEFAULT 0,
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE notice_attachments
  DROP CONSTRAINT IF EXISTS chk_notice_attachment_source,
  ADD CONSTRAINT chk_notice_attachment_source CHECK (
    (file_key IS NOT NULL AND external_url IS NULL) OR
    (file_key IS NULL AND external_url IS NOT NULL)
  );
