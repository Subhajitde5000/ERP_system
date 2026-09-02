-- ============================================================================
--  PARENT PORTAL — Module Catalog & Plan Entitlement Migration
--  Delta migration: run this on an EXISTING database.
--
--    psql -U erp_user -d erp_db -f database/update_parent_module.sql
--
--  1. Adds 'parent' (Parent Portal) to the modules table so Super Admins
--     can include/exclude it when configuring subscription plans.
--  2. Connects the PARENT role to module_key = 'parent'.
-- ============================================================================

BEGIN;

-- 1. Insert 'parent' module if not already present
INSERT INTO modules (key, name, description, is_core, icon, price_monthly, sort_order)
VALUES (
  'parent',
  'Parent Portal',
  'Guardian portal, student-linked access, attendance & results view.',
  FALSE,
  'Users',
  0.00,
  17
)
ON CONFLICT (key) DO UPDATE
   SET name = EXCLUDED.name,
       description = EXCLUDED.description,
       icon = EXCLUDED.icon;

-- 2. Link PARENT role to 'parent' module
UPDATE roles
   SET module_key = 'parent',
       is_optional = TRUE
 WHERE name = 'PARENT';

COMMIT;
