-- 0014: bloqueio do acesso público via PostgREST.
-- A app fala com o Postgres pelo servidor (role postgres, dono das tabelas).
-- A chave pública (anon) e os utilizadores autenticados do Supabase não devem
-- ler nada diretamente: RLS ativo sem políticas + privilégios revogados.

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
--> statement-breakpoint
-- Tabelas criadas no futuro ficam com RLS ativo automaticamente.
CREATE OR REPLACE FUNCTION public.enable_rls_on_new_tables()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
DECLARE obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE command_tag = 'CREATE TABLE' AND schema_name = 'public' LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', obj.object_identity);
  END LOOP;
END;
$$;
--> statement-breakpoint
DROP EVENT TRIGGER IF EXISTS enable_rls_on_new_tables;
--> statement-breakpoint
CREATE EVENT TRIGGER enable_rls_on_new_tables ON ddl_command_end WHEN TAG IN ('CREATE TABLE') EXECUTE FUNCTION public.enable_rls_on_new_tables();
