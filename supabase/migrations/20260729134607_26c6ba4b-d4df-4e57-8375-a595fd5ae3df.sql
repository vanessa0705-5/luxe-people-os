
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.tipo_contrato AS ENUM ('clt', 'pj', 'temporario', 'estagio', 'terceirizado');
CREATE TYPE public.status_colaborador AS ENUM ('ativo', 'afastado', 'ferias', 'desligado');
CREATE TYPE public.sexo AS ENUM ('masculino', 'feminino', 'outro');
CREATE TYPE public.estado_civil AS ENUM ('solteiro', 'casado', 'divorciado', 'viuvo', 'uniao_estavel');

-- =========================================================
-- HELPER: pode gerenciar (admin_principal ou rh)
-- =========================================================
CREATE OR REPLACE FUNCTION public.pode_gerenciar_rh(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin_principal'::app_role)
      OR public.has_role(_user_id, 'rh'::app_role)
$$;

-- =========================================================
-- TABELA: tomadores (estrutura mínima)
-- =========================================================
CREATE TABLE public.tomadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tomadores TO authenticated;
GRANT ALL ON public.tomadores TO service_role;

ALTER TABLE public.tomadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem tomadores"
  ON public.tomadores FOR SELECT TO authenticated USING (true);

CREATE POLICY "RH e Admin criam tomadores"
  ON public.tomadores FOR INSERT TO authenticated
  WITH CHECK (public.pode_gerenciar_rh(auth.uid()));

CREATE POLICY "RH e Admin editam tomadores"
  ON public.tomadores FOR UPDATE TO authenticated
  USING (public.pode_gerenciar_rh(auth.uid()))
  WITH CHECK (public.pode_gerenciar_rh(auth.uid()));

CREATE POLICY "Somente Admin Principal exclui tomadores"
  ON public.tomadores FOR DELETE TO authenticated
  USING (public.is_admin_principal(auth.uid()));

CREATE TRIGGER trg_tomadores_updated_at
  BEFORE UPDATE ON public.tomadores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- TABELA: colaboradores
-- =========================================================
CREATE TABLE public.colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dados pessoais
  nome_completo text NOT NULL,
  cpf text NOT NULL UNIQUE,
  rg text,
  rg_orgao_emissor text,
  data_nascimento date,
  sexo public.sexo,
  estado_civil public.estado_civil,
  nacionalidade text DEFAULT 'Brasileira',
  telefone text,
  email text,

  -- Endereço
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,

  -- Dados contratuais
  matricula text UNIQUE,
  cargo text,
  funcao text,
  departamento text,
  data_admissao date,
  data_desligamento date,
  tipo_contrato public.tipo_contrato,
  salario numeric(12,2),
  jornada_semanal integer,
  banco text,
  agencia text,
  conta text,

  -- Vínculo organizacional
  tomador_id uuid NOT NULL REFERENCES public.tomadores(id) ON DELETE RESTRICT,

  -- Documentos trabalhistas
  ctps_numero text,
  ctps_serie text,
  pis_pasep text,
  titulo_eleitor text,
  titulo_zona text,
  titulo_secao text,
  reservista text,

  -- Status
  status public.status_colaborador NOT NULL DEFAULT 'ativo',
  observacoes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_colaboradores_tomador ON public.colaboradores(tomador_id);
CREATE INDEX idx_colaboradores_status ON public.colaboradores(status);
CREATE INDEX idx_colaboradores_nome ON public.colaboradores(nome_completo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.colaboradores TO authenticated;
GRANT ALL ON public.colaboradores TO service_role;

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem colaboradores"
  ON public.colaboradores FOR SELECT TO authenticated USING (true);

CREATE POLICY "RH e Admin criam colaboradores"
  ON public.colaboradores FOR INSERT TO authenticated
  WITH CHECK (public.pode_gerenciar_rh(auth.uid()));

CREATE POLICY "RH e Admin editam colaboradores"
  ON public.colaboradores FOR UPDATE TO authenticated
  USING (public.pode_gerenciar_rh(auth.uid()))
  WITH CHECK (public.pode_gerenciar_rh(auth.uid()));

CREATE POLICY "Somente Admin Principal exclui colaboradores"
  ON public.colaboradores FOR DELETE TO authenticated
  USING (public.is_admin_principal(auth.uid()));

CREATE TRIGGER trg_colaboradores_updated_at
  BEFORE UPDATE ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- TABELA: colaborador_dependentes
-- =========================================================
CREATE TABLE public.colaborador_dependentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  nome_completo text NOT NULL,
  parentesco text NOT NULL,
  cpf text,
  data_nascimento date,
  usa_ir boolean NOT NULL DEFAULT false,
  usa_salario_familia boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dependentes_colaborador ON public.colaborador_dependentes(colaborador_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.colaborador_dependentes TO authenticated;
GRANT ALL ON public.colaborador_dependentes TO service_role;

ALTER TABLE public.colaborador_dependentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem dependentes"
  ON public.colaborador_dependentes FOR SELECT TO authenticated USING (true);

CREATE POLICY "RH e Admin criam dependentes"
  ON public.colaborador_dependentes FOR INSERT TO authenticated
  WITH CHECK (public.pode_gerenciar_rh(auth.uid()));

CREATE POLICY "RH e Admin editam dependentes"
  ON public.colaborador_dependentes FOR UPDATE TO authenticated
  USING (public.pode_gerenciar_rh(auth.uid()))
  WITH CHECK (public.pode_gerenciar_rh(auth.uid()));

CREATE POLICY "Somente Admin Principal exclui dependentes"
  ON public.colaborador_dependentes FOR DELETE TO authenticated
  USING (public.is_admin_principal(auth.uid()));

CREATE TRIGGER trg_dependentes_updated_at
  BEFORE UPDATE ON public.colaborador_dependentes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
