-- 1. Novos perfis de acesso
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'departamento_pessoal';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'seguranca_trabalho';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'visualizador';

-- 2. Funcoes de permissao (comparacao textual para evitar dependencia de labels novos na mesma transacao)
CREATE OR REPLACE FUNCTION public.pode_gerenciar_sst(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin_principal', 'rh', 'seguranca_trabalho')
  )
$$;

CREATE OR REPLACE FUNCTION public.pode_gerenciar_dp(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin_principal', 'rh', 'departamento_pessoal')
  )
$$;

-- 3. Unidade do colaborador
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS unidade text;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;

-- 4. Enums dos novos modulos
DO $$ BEGIN
  CREATE TYPE public.tipo_exame_aso AS ENUM ('admissional','periodico','retorno_trabalho','mudanca_risco','demissional');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.resultado_aso AS ENUM ('apto','inapto','apto_com_restricao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Catalogo de NRs
CREATE TABLE IF NOT EXISTS public.nrs_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  validade_meses integer NOT NULL DEFAULT 24,
  obrigatoria boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nrs_catalogo TO authenticated;
GRANT ALL ON public.nrs_catalogo TO service_role;
ALTER TABLE public.nrs_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem catalogo de NRs" ON public.nrs_catalogo
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin principal gerencia catalogo de NRs" ON public.nrs_catalogo
  FOR ALL TO authenticated
  USING (public.is_admin_principal(auth.uid()))
  WITH CHECK (public.is_admin_principal(auth.uid()));

CREATE TRIGGER trg_nrs_catalogo_updated_at BEFORE UPDATE ON public.nrs_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.nrs_catalogo (codigo, nome, validade_meses, obrigatoria) VALUES
  ('NR-01', 'Disposições Gerais e Gerenciamento de Riscos Ocupacionais', 12, true),
  ('NR-05', 'CIPA - Comissão Interna de Prevenção de Acidentes', 12, false),
  ('NR-06', 'Equipamento de Proteção Individual - EPI', 12, true),
  ('NR-10', 'Segurança em Instalações e Serviços em Eletricidade', 24, false),
  ('NR-11', 'Transporte, Movimentação, Armazenagem e Manuseio de Materiais', 36, false),
  ('NR-12', 'Segurança no Trabalho em Máquinas e Equipamentos', 24, false),
  ('NR-18', 'Condições de Segurança e Saúde na Indústria da Construção', 12, false),
  ('NR-20', 'Segurança e Saúde no Trabalho com Inflamáveis e Combustíveis', 24, false),
  ('NR-23', 'Proteção Contra Incêndios', 12, false),
  ('NR-33', 'Segurança e Saúde nos Trabalhos em Espaços Confinados', 12, false),
  ('NR-35', 'Trabalho em Altura', 24, false)
ON CONFLICT (codigo) DO NOTHING;

-- 6. ASOs
CREATE TABLE IF NOT EXISTS public.asos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  unidade text,
  cargo text,
  matricula text,
  cpf text,
  tipo_exame public.tipo_exame_aso NOT NULL,
  clinica text,
  medico_responsavel text,
  crm text,
  data_exame date NOT NULL,
  data_vencimento date,
  resultado public.resultado_aso,
  observacoes text,
  arquivo_path text,
  arquivo_nome text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asos_colaborador ON public.asos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_asos_vencimento ON public.asos(data_vencimento);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asos TO authenticated;
GRANT ALL ON public.asos TO service_role;
ALTER TABLE public.asos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem asos" ON public.asos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "SST RH e Admin criam asos" ON public.asos
  FOR INSERT TO authenticated WITH CHECK (public.pode_gerenciar_sst(auth.uid()));
CREATE POLICY "SST RH e Admin editam asos" ON public.asos
  FOR UPDATE TO authenticated
  USING (public.pode_gerenciar_sst(auth.uid()))
  WITH CHECK (public.pode_gerenciar_sst(auth.uid()));
CREATE POLICY "Somente Admin Principal exclui asos" ON public.asos
  FOR DELETE TO authenticated USING (public.is_admin_principal(auth.uid()));

CREATE TRIGGER trg_asos_updated_at BEFORE UPDATE ON public.asos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Validacao de datas (trigger em vez de CHECK por depender de comparacoes de datas)
CREATE OR REPLACE FUNCTION public.validar_aso()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.data_vencimento IS NOT NULL AND NEW.data_vencimento < NEW.data_exame THEN
    RAISE EXCEPTION 'A data de vencimento não pode ser anterior à data do exame';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_asos_validar BEFORE INSERT OR UPDATE ON public.asos
  FOR EACH ROW EXECUTE FUNCTION public.validar_aso();

-- 7. Historico de alteracoes de ASO
CREATE TABLE IF NOT EXISTS public.aso_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aso_id uuid,
  colaborador_id uuid,
  acao text NOT NULL,
  alteracoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aso_historico_aso ON public.aso_historico(aso_id);

GRANT SELECT ON public.aso_historico TO authenticated;
GRANT ALL ON public.aso_historico TO service_role;
ALTER TABLE public.aso_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SST RH e Admin veem historico de asos" ON public.aso_historico
  FOR SELECT TO authenticated USING (public.pode_gerenciar_sst(auth.uid()));

CREATE OR REPLACE FUNCTION public.registrar_historico_aso()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE mudancas jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.aso_historico (aso_id, colaborador_id, acao, alteracoes, user_id)
    VALUES (NEW.id, NEW.colaborador_id, 'criacao', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(n.key, jsonb_build_object('de', o.value, 'para', n.value))
      INTO mudancas
    FROM jsonb_each(to_jsonb(NEW)) n
    JOIN jsonb_each(to_jsonb(OLD)) o ON o.key = n.key
    WHERE n.value IS DISTINCT FROM o.value
      AND n.key NOT IN ('updated_at', 'updated_by');
    IF mudancas IS NOT NULL AND mudancas <> '{}'::jsonb THEN
      INSERT INTO public.aso_historico (aso_id, colaborador_id, acao, alteracoes, user_id)
      VALUES (NEW.id, NEW.colaborador_id, 'alteracao', mudancas, auth.uid());
    END IF;
    RETURN NEW;
  ELSE
    INSERT INTO public.aso_historico (aso_id, colaborador_id, acao, alteracoes, user_id)
    VALUES (OLD.id, OLD.colaborador_id, 'exclusao', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER trg_asos_historico AFTER INSERT OR UPDATE OR DELETE ON public.asos
  FOR EACH ROW EXECUTE FUNCTION public.registrar_historico_aso();

-- 8. Treinamentos de NRs
CREATE TABLE IF NOT EXISTS public.nr_treinamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  unidade text,
  cargo text,
  nr_codigo text NOT NULL,
  nome_treinamento text NOT NULL,
  instrutor text,
  data_realizacao date NOT NULL,
  carga_horaria numeric,
  data_validade date,
  certificado_path text,
  certificado_nome text,
  observacoes text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nr_treinamentos_colaborador ON public.nr_treinamentos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_nr_treinamentos_validade ON public.nr_treinamentos(data_validade);
CREATE INDEX IF NOT EXISTS idx_nr_treinamentos_nr ON public.nr_treinamentos(nr_codigo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nr_treinamentos TO authenticated;
GRANT ALL ON public.nr_treinamentos TO service_role;
ALTER TABLE public.nr_treinamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem treinamentos" ON public.nr_treinamentos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "SST RH e Admin criam treinamentos" ON public.nr_treinamentos
  FOR INSERT TO authenticated WITH CHECK (public.pode_gerenciar_sst(auth.uid()));
CREATE POLICY "SST RH e Admin editam treinamentos" ON public.nr_treinamentos
  FOR UPDATE TO authenticated
  USING (public.pode_gerenciar_sst(auth.uid()))
  WITH CHECK (public.pode_gerenciar_sst(auth.uid()));
CREATE POLICY "Somente Admin Principal exclui treinamentos" ON public.nr_treinamentos
  FOR DELETE TO authenticated USING (public.is_admin_principal(auth.uid()));

CREATE TRIGGER trg_nr_treinamentos_updated_at BEFORE UPDATE ON public.nr_treinamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validar_nr_treinamento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.data_validade IS NOT NULL AND NEW.data_validade < NEW.data_realizacao THEN
    RAISE EXCEPTION 'A data de validade não pode ser anterior à data de realização';
  END IF;
  IF NEW.carga_horaria IS NOT NULL AND NEW.carga_horaria <= 0 THEN
    RAISE EXCEPTION 'A carga horária deve ser maior que zero';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_nr_treinamentos_validar BEFORE INSERT OR UPDATE ON public.nr_treinamentos
  FOR EACH ROW EXECUTE FUNCTION public.validar_nr_treinamento();