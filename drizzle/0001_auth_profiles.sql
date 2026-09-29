-- 0001: ligação profiles ↔ auth.users, criação automática do perfil e updated_at.

ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_id_auth_users_fk"
  FOREIGN KEY ("id") REFERENCES auth.users("id") ON DELETE CASCADE;
--> statement-breakpoint

-- Quando o Supabase Auth cria um utilizador (convite ou criação por admin),
-- cria o perfil na organização única. Nome e papel vêm dos metadados.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id uuid;
  meta_role text;
BEGIN
  SELECT id INTO org_id FROM public.organizations ORDER BY created_at LIMIT 1;
  meta_role := NEW.raw_user_meta_data->>'role';
  IF meta_role IS NULL OR meta_role NOT IN ('admin','manager','user') THEN
    meta_role := 'user';
  END IF;

  INSERT INTO public.profiles (id, organization_id, full_name, email, role)
  VALUES (
    NEW.id,
    org_id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    meta_role::user_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--> statement-breakpoint
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
--> statement-breakpoint

-- Mantém o email do perfil sincronizado se mudar no Auth.
CREATE OR REPLACE FUNCTION public.handle_user_email_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id AND email IS DISTINCT FROM NEW.email;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
--> statement-breakpoint
CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_change();
--> statement-breakpoint

-- updated_at automático (reutilizado por todas as tabelas futuras).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER organizations_set_updated_at
  BEFORE UPDATE ON "organizations"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON "profiles"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
