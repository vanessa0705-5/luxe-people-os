-- Módulo Rateio de Folha
CREATE OR REPLACE FUNCTION public.pode_gerenciar_financeiro(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin_principal', 'rh', 'departamento_pessoal')
  )
$$;

CREATE TABLE IF NOT EXISTS public.rateios_folha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia date NOT NULL,
  arquivo_folha_nome text,
  arquivo_rateio_nome text,
  quantidade_empresas integer NOT NULL DEFAULT 0,
  quantidade_tomadores integer NOT NULL DEFAULT 0,
  quantidade_colaboradores integer NOT NULL DEFAULT 0,
  total_folha numeric(16,2) NOT NULL DEFAULT 0,
  total_fgts_consignado numeric(16,2) NOT NULL DEFAULT 0,
  total_inss numeric(16,2) NOT NULL DEFAULT 0,
  total_irrf numeric(16,2) NOT NULL DEFAULT 0,
  total_geral numeric(16,2) NOT NULL DEFAULT 0,
  resultado jsonb NOT NULL DEFAULT '{}'::jsonb,
  folha_origem jsonb NOT NULL DEFAULT '[]'::jsonb,
  rateio_origem jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rateios_folha_competencia
  ON public.rateios_folha(competencia DESC);
CREATE INDEX IF NOT EXISTS idx_rateios_folha_created_at
  ON public.rateios_folha(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rateios_folha TO authenticated;
GRANT ALL ON public.rateios_folha TO service_role;
ALTER TABLE public.rateios_folha ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financeiro consulta rateios de folha"
  ON public.rateios_folha FOR SELECT TO authenticated
  USING (public.pode_gerenciar_financeiro(auth.uid()));

CREATE POLICY "Financeiro cria rateios de folha"
  ON public.rateios_folha FOR INSERT TO authenticated
  WITH CHECK (public.pode_gerenciar_financeiro(auth.uid()));

CREATE POLICY "Financeiro atualiza rateios de folha"
  ON public.rateios_folha FOR UPDATE TO authenticated
  USING (public.pode_gerenciar_financeiro(auth.uid()))
  WITH CHECK (public.pode_gerenciar_financeiro(auth.uid()));

CREATE POLICY "Administrador exclui rateios de folha"
  ON public.rateios_folha FOR DELETE TO authenticated
  USING (public.is_admin_principal(auth.uid()));

CREATE TRIGGER trg_rateios_folha_updated_at
  BEFORE UPDATE ON public.rateios_folha
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
