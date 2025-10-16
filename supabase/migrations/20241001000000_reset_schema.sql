-- Reseta completamente o schema público para recomeçar do zero.
DO $$
DECLARE
  obj RECORD;
BEGIN
  -- Remove views primeiro
  FOR obj IN (
    SELECT table_schema, table_name
    FROM information_schema.views
    WHERE table_schema = 'public'
  ) LOOP
    EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE;', obj.table_schema, obj.table_name);
  END LOOP;

  -- Remove tabelas
  FOR obj IN (
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I.%I CASCADE;', obj.schemaname, obj.tablename);
  END LOOP;

  -- Remove sequências
  FOR obj IN (
    SELECT sequence_schema, sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  ) LOOP
    EXECUTE format('DROP SEQUENCE IF EXISTS %I.%I CASCADE;', obj.sequence_schema, obj.sequence_name);
  END LOOP;
END $$;
