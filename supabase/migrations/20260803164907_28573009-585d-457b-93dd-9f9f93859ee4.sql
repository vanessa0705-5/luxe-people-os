CREATE TYPE public.status_ferias AS ENUM ('solicitada','aprovada','reprovada','em_gozo','concluida','cancelada');

CREATE TABLE public.ferias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  periodo_aquisitivo_inicio date,
  periodo_aquisitivo_fim date,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  dias integer NOT NULL DEFAULT 30,
  status public.status_ferias NOT NULL DEFAULT 'solicitada',
  observacoes text,
  motivo_reprovacao text,
  solicitado_por uuid REFERENCES auth.users(id),
  aprovado_por uuid REFERENCES auth.users(id),
  aprovado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ferias_colaborador ON public.ferias(colaborador_id);
CREATE INDEX idx_ferias_status ON public.ferias(status);
CREATE INDEX idx_ferias_data_inicio ON public.ferias(data_inicio);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ferias TO authenticated;
GRANT ALL ON public.ferias TO service_role;

ALTER TABLE public.ferias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem ferias"
ON public.ferias FOR SELECT TO authenticated USING (true);

CREATE POLICY "Gestor RH e Admin criam ferias"
ON public.ferias FOR INSERT TO authenticated
WITH CHECK (public.pode_gerenciar_rh(auth.uid()) OR public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "RH e Admin editam ferias"
ON public.ferias FOR UPDATE TO authenticated
USING (public.pode_gerenciar_rh(auth.uid()))
WITH CHECK (public.pode_gerenciar_rh(auth.uid()));

CREATE POLICY "Somente Admin Principal exclui ferias"
ON public.ferias FOR DELETE TO authenticated
USING (public.is_admin_principal(auth.uid()));

CREATE TRIGGER trg_ferias_updated_at
BEFORE UPDATE ON public.ferias
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validar_ferias()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.data_fim < NEW.data_inicio THEN
    RAISE EXCEPTION 'A data final das férias não pode ser anterior à data inicial';
  END IF;
  IF NEW.dias IS NULL OR NEW.dias <= 0 THEN
    RAISE EXCEPTION 'A quantidade de dias deve ser maior que zero';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ferias_validar
BEFORE INSERT OR UPDATE ON public.ferias
FOR EACH ROW EXECUTE FUNCTION public.validar_ferias();