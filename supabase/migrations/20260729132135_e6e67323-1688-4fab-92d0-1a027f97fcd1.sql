
-- Enum de perfis de acesso
CREATE TYPE public.app_role AS ENUM ('admin_principal', 'rh', 'gestor', 'consulta');

-- Tabela de profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  avatar_url TEXT,
  job_title TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Tabela de user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função security definer para verificar papel
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Função para verificar se é admin principal
CREATE OR REPLACE FUNCTION public.is_admin_principal(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin_principal');
$$;

-- Políticas: profiles
CREATE POLICY "Usuários autenticados podem ver perfis"
ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários atualizam o próprio perfil"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Admin principal gerencia todos os perfis"
ON public.profiles FOR ALL TO authenticated
USING (public.is_admin_principal(auth.uid()))
WITH CHECK (public.is_admin_principal(auth.uid()));

-- Políticas: user_roles
CREATE POLICY "Usuários autenticados veem papéis"
ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin principal gerencia papéis"
ON public.user_roles FOR ALL TO authenticated
USING (public.is_admin_principal(auth.uid()))
WITH CHECK (public.is_admin_principal(auth.uid()));

-- Tabela de auditoria
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin principal e RH veem auditoria"
ON public.audit_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin_principal') OR public.has_role(auth.uid(), 'rh'));

CREATE POLICY "Usuários autenticados inserem logs"
ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin principal exclui auditoria"
ON public.audit_log FOR DELETE TO authenticated
USING (public.is_admin_principal(auth.uid()));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger para criar profile automático
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );
  -- Perfil padrão de consulta
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'consulta');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
