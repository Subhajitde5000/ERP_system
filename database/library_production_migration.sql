-- Production migration: library integrity, circulation concurrency and counters.
-- Safe to run once against an existing database; database.sql includes the same final state.
BEGIN;

ALTER TABLE books DROP CONSTRAINT IF EXISTS books_tenant_id_fkey;
ALTER TABLE books ADD CONSTRAINT books_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE book_copies DROP CONSTRAINT IF EXISTS book_copies_book_id_fkey;
ALTER TABLE book_copies ADD CONSTRAINT book_copies_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
ALTER TABLE book_copies DROP CONSTRAINT IF EXISTS book_copies_tenant_id_fkey;
ALTER TABLE book_copies ADD CONSTRAINT book_copies_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE book_issues DROP CONSTRAINT IF EXISTS book_issues_tenant_id_fkey;
ALTER TABLE book_issues ADD CONSTRAINT book_issues_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE e_resources DROP CONSTRAINT IF EXISTS e_resources_tenant_id_fkey;
ALTER TABLE e_resources ADD CONSTRAINT e_resources_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE books ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE books ALTER COLUMN total_copies SET DEFAULT 0;
ALTER TABLE books ALTER COLUMN available_copies SET DEFAULT 0;
ALTER TABLE books DROP CONSTRAINT IF EXISTS ck_books_copy_counts;
ALTER TABLE books ADD CONSTRAINT ck_books_copy_counts CHECK (total_copies >= 0 AND available_copies BETWEEN 0 AND total_copies);
ALTER TABLE books DROP CONSTRAINT IF EXISTS ck_books_publication_year;
ALTER TABLE books ADD CONSTRAINT ck_books_publication_year CHECK (publication_year IS NULL OR publication_year BETWEEN 1000 AND 2100);

CREATE UNIQUE INDEX IF NOT EXISTS uq_books_tenant_isbn ON books (tenant_id, isbn) WHERE isbn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_books_tenant_title ON books (tenant_id, title);
CREATE UNIQUE INDEX IF NOT EXISTS uq_book_issues_active_copy ON book_issues (copy_id) WHERE returned_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_book_issues_tenant_due_active ON book_issues (tenant_id, due_date) WHERE returned_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_e_resources_tenant_subject ON e_resources (tenant_id, subject_area);

ALTER TABLE book_issues DROP CONSTRAINT IF EXISTS ck_book_issues_dates;
ALTER TABLE book_issues ADD CONSTRAINT ck_book_issues_dates CHECK (due_date >= issued_at::date AND (returned_at IS NULL OR returned_at >= issued_at));
ALTER TABLE book_issues DROP CONSTRAINT IF EXISTS ck_book_issues_fine;
ALTER TABLE book_issues ADD CONSTRAINT ck_book_issues_fine CHECK (fine_amount >= 0 AND (NOT fine_paid OR returned_at IS NOT NULL));
ALTER TABLE e_resources DROP CONSTRAINT IF EXISTS ck_e_resources_source;
ALTER TABLE e_resources ADD CONSTRAINT ck_e_resources_source CHECK ((url IS NOT NULL) <> (file_key IS NOT NULL));
ALTER TABLE e_resources DROP CONSTRAINT IF EXISTS ck_e_resources_type;
ALTER TABLE e_resources ADD CONSTRAINT ck_e_resources_type CHECK (resource_type IN ('EBOOK', 'JOURNAL', 'PAPER', 'LINK'));

-- Reject cross-tenant/book references that individual foreign keys cannot detect.
CREATE OR REPLACE FUNCTION validate_library_row() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'book_copies' AND NOT EXISTS (
    SELECT 1 FROM books b WHERE b.id = NEW.book_id AND b.tenant_id = NEW.tenant_id
  ) THEN RAISE EXCEPTION 'Library copy tenant does not match book tenant'; END IF;
  IF TG_TABLE_NAME = 'book_issues' AND (
    NOT EXISTS (SELECT 1 FROM book_copies c WHERE c.id = NEW.copy_id AND c.book_id = NEW.book_id AND c.tenant_id = NEW.tenant_id)
    OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.borrower_id AND u.tenant_id = NEW.tenant_id)
    OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.issued_by AND u.tenant_id = NEW.tenant_id)
    OR (NEW.returned_to IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.returned_to AND u.tenant_id = NEW.tenant_id))
  ) THEN RAISE EXCEPTION 'Library issue references do not belong to its tenant'; END IF;
  IF TG_TABLE_NAME = 'e_resources' AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = NEW.uploaded_by AND u.tenant_id = NEW.tenant_id
  ) THEN RAISE EXCEPTION 'Library resource uploader does not belong to its tenant'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_book_copy ON book_copies;
CREATE TRIGGER trg_validate_book_copy BEFORE INSERT OR UPDATE ON book_copies FOR EACH ROW EXECUTE FUNCTION validate_library_row();
DROP TRIGGER IF EXISTS trg_validate_book_issue ON book_issues;
CREATE TRIGGER trg_validate_book_issue BEFORE INSERT OR UPDATE ON book_issues FOR EACH ROW EXECUTE FUNCTION validate_library_row();
DROP TRIGGER IF EXISTS trg_validate_e_resource ON e_resources;
CREATE TRIGGER trg_validate_e_resource BEFORE INSERT OR UPDATE ON e_resources FOR EACH ROW EXECUTE FUNCTION validate_library_row();

-- Counters are derived from copies, never trusted application input.
CREATE OR REPLACE FUNCTION refresh_book_copy_counts() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE target UUID := COALESCE(NEW.book_id, OLD.book_id);
BEGIN
  UPDATE books b SET
    total_copies = (SELECT COUNT(*) FROM book_copies c WHERE c.book_id = target),
    available_copies = (SELECT COUNT(*) FROM book_copies c WHERE c.book_id = target AND c.is_available AND c.condition IN ('GOOD','FAIR')),
    updated_at = NOW()
  WHERE b.id = target;
  IF TG_OP = 'UPDATE' AND OLD.book_id <> NEW.book_id THEN
    UPDATE books b SET
      total_copies = (SELECT COUNT(*) FROM book_copies c WHERE c.book_id = OLD.book_id),
      available_copies = (SELECT COUNT(*) FROM book_copies c WHERE c.book_id = OLD.book_id AND c.is_available AND c.condition IN ('GOOD','FAIR')),
      updated_at = NOW()
    WHERE b.id = OLD.book_id;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_refresh_book_copy_counts ON book_copies;
CREATE TRIGGER trg_refresh_book_copy_counts AFTER INSERT OR UPDATE OR DELETE ON book_copies FOR EACH ROW EXECUTE FUNCTION refresh_book_copy_counts();

-- Reconcile legacy counters before enforcing application reads.
UPDATE books b SET
  total_copies = (SELECT COUNT(*) FROM book_copies c WHERE c.book_id = b.id),
  available_copies = (SELECT COUNT(*) FROM book_copies c WHERE c.book_id = b.id AND c.is_available AND c.condition IN ('GOOD','FAIR')),
  updated_at = NOW();

COMMIT;
