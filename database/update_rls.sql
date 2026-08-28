-- ============================================================================
--  update_rls.sql — Enable Row-Level Security on every tenant-scoped table
--  Audit issue H3: defence-in-depth tenant isolation inside PostgreSQL.
-- ============================================================================
--
--  WHY
--  ---
--  Until now tenant isolation was enforced ONLY in the application layer
--  (every query filtered by tenant_id). A single missed filter would leak
--  cross-tenant data. RLS adds a second, independent barrier: PostgreSQL
--  itself refuses to return or write rows of another tenant even if the app
--  query is wrong.
--
--  HOW IT WORKS
--  ------------
--  For every table that has a `tenant_id` column this script:
--    1. ENABLES row-level security,
--    2. FORCES it (so even the table OWNER is subject — required because the
--       app connects with the owning role),
--    3. installs one policy, `tenant_isolation`, allowing a row only when:
--         tenant_id = current_setting('app.tenant_id')::uuid   -- tenant ctx
--         OR current_setting('app.rls_bypass') = 'on'           -- platform ctx
--
--  The backend sets these session settings per request
--  (backend/app/security/rls.py):
--    * authenticated tenant requests  → app.tenant_id = <their tenant>
--    * platform / owner / public-bootstrap contexts → app.rls_bypass = 'on'
--    * connections returned to the pool are RESET so context never leaks.
--
--  IMPORTANT OPERATIONAL NOTES
--  ---------------------------
--  * The application's database role must NOT be a PostgreSQL SUPERUSER and
--    must not have the BYPASSRLS attribute — superusers always skip RLS.
--  * Seeds / data migrations / psql maintenance must first run:
--        SELECT set_config('app.rls_bypass', 'on', false);
--    (or connect as a superuser) — otherwise their INSERTs are blocked.
--  * Tables WITHOUT tenant_id (tenants, platform_users, platform_owners,
--    user_sessions, plans, modules, ...) are unaffected by design.
--  * Idempotent: safe to run again; new tenant-scoped tables need a re-run.
--
--  Usage:
--      psql -U erp_user -d erp_db -v ON_ERROR_STOP=1 -f database/update_rls.sql
-- ============================================================================

DO $rls$
DECLARE
    t record;
    policy_expr text :=
        'tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid '
        'OR current_setting(''app.rls_bypass'', true) = ''on''';
BEGIN
    FOR t IN
        SELECT c.relname AS table_name
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE a.attname = 'tenant_id'
          AND NOT a.attisdropped
          AND n.nspname = 'public'
          AND c.relkind = 'r'
        ORDER BY c.relname
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.table_name);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t.table_name);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t.table_name);
        EXECUTE format(
            'CREATE POLICY tenant_isolation ON %I FOR ALL USING (%s) WITH CHECK (%s)',
            t.table_name, policy_expr, policy_expr
        );
        RAISE NOTICE 'RLS enabled on %', t.table_name;
    END LOOP;
END
$rls$;

-- Verification: report how many tables now have RLS forced.
SELECT count(*) AS rls_forced_tables
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relforcerowsecurity;
