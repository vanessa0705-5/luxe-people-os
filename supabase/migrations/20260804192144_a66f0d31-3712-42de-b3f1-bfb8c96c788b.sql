DO $$ BEGIN
  CREATE TYPE public.tipo_movimentacao AS ENUM ('promocao','alteracao_salarial','transferencia','afastamento','retorno','admissao','desligamento');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  tipo public.tipo_movimentacao NOT NULL,
  data_efeito date NOT NULL DEFAULT CURRENT_DATE,
  motivo text,
  observacoes text,
  cargo_anterior text,
  cargo_novo text,
  funcao_anterior text,
  funcao_nova text,
  salario_anterior numeric,
  salario_novo numeric,
  departamento_anterior text,
  departamento_novo text,
  tomador_anterior_id uuid REFERENCES public.tomadores(id),
  tomador_novo_id uuid REFERENCES public.tomadores(id),
  coordenador_anterior_id uuid REFERENCES public.colaboradores(id),
  coordenador_novo_id uuid REFERENCES public.colaboradores(id),
  status_anterior public.status_colaborador,
  status_novo public.status_colaborador,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimentacoes TO authenticated;
GRANT ALL ON public.movimentacoes TO service_role;

ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem movimentacoes" ON public.movimentacoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "RH e Admin criam movimentacoes" ON public.movimentacoes
  FOR INSERT TO authenticated WITH CHECK (public.pode_gerenciar_rh(auth.uid()));
CREATE POLICY "RH e Admin editam movimentacoes" ON public.movimentacoes
  FOR UPDATE TO authenticated USING (public.pode_gerenciar_rh(auth.uid())) WITH CHECK (public.pode_gerenciar_rh(auth.uid()));
CREATE POLICY "Somente Admin Principal exclui movimentacoes" ON public.movimentacoes
  FOR DELETE TO authenticated USING (public.is_admin_principal(auth.uid()));

CREATE TRIGGER trg_movimentacoes_updated_at BEFORE UPDATE ON public.movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.aplicar_movimentacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE c public.colaboradores;
BEGIN
  SELECT * INTO c FROM public.colaboradores WHERE id = NEW.colaborador_id;
  IF c.id IS NULL THEN
    RAISE EXCEPTION 'Colaborador não encontrado';
  END IF;

  -- Preenche automaticamente os valores anteriores
  NEW.cargo_anterior := c.cargo;
  NEW.funcao_anterior := c.funcao;
  NEW.salario_anterior := c.salario;
  NEW.departamento_anterior := c.departamento;
  NEW.tomador_anterior_id := c.tomador_id;
  NEW.coordenador_anterior_id := c.coordenador_id;
  NEW.status_anterior := c.status;

  UPDATE public.colaboradores SET
    cargo = COALESCE(NEW.cargo_novo, cargo),
    funcao = COALESCE(NEW.funcao_nova, funcao),
    salario = COALESCE(NEW.salario_novo, salario),
    departamento = COALESCE(NEW.departamento_novo, departamento),
    tomador_id = COALESCE(NEW.tomador_novo_id, tomador_id),
    coordenador_id = COALESCE(NEW.coordenador_novo_id, coordenador_id),
    status = COALESCE(NEW.status_novo, status),
    data_admissao = CASE WHEN NEW.tipo = 'admissao' THEN NEW.data_efeito ELSE data_admissao END,
    data_desligamento = CASE WHEN NEW.tipo = 'desligamento' THEN NEW.data_efeito ELSE data_desligamento END
  WHERE id = NEW.colaborador_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_movimentacoes_aplicar BEFORE INSERT ON public.movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.aplicar_movimentacao();