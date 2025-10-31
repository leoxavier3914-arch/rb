DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN (
        SELECT quote_ident(tablename) AS tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || rec.tablename || ' CASCADE';
    END LOOP;
END
$$;
