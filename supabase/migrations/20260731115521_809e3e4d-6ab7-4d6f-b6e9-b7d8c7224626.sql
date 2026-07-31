CREATE TYPE public.status_empresa AS ENUM ('ativa', 'inativa');

CREATE TABLE public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text NOT NULL UNIQUE,
  inscricao_estadual text,
  inscricao_municipal text,
  cnae text,
  status public.status_empresa NOT NULL DEFAULT 'ativa',
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  responsavel_nome text,
  email text,
  telefone text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem empresas"
  ON public.empresas FOR SELECT TO authenticated USING (true);

CREATE POLICY "RH e Admin criam empresas"
  ON public.empresas FOR INSERT TO authenticated
  WITH CHECK (public.pode_gerenciar_rh(auth.uid()));

CREATE POLICY "RH e Admin editam empresas"
  ON public.empresas FOR UPDATE TO authenticated
  USING (public.pode_gerenciar_rh(auth.uid()))
  WITH CHECK (public.pode_gerenciar_rh(auth.uid()));

CREATE POLICY "Somente Admin Principal exclui empresas"
  ON public.empresas FOR DELETE TO authenticated
  USING (public.is_admin_principal(auth.uid()));

CREATE TRIGGER set_empresas_updated_at
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tomadores
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tomadores_empresa_id ON public.tomadores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_empresas_status ON public.empresas(status);