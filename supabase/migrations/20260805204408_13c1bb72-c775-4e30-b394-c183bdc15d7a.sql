ALTER TABLE public.tomadores
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS logradouro text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS uf text;

CREATE TABLE IF NOT EXISTS public.tomador_coordenadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tomador_id uuid NOT NULL REFERENCES public.tomadores(id) ON DELETE CASCADE,
  colaborador_id uuid REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  nome_completo text NOT NULL,
  cargo text,
  email text,
  telefone text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tomador_coordenadores TO authenticated;
GRANT ALL ON public.tomador_coordenadores TO service_role;

ALTER TABLE public.tomador_coordenadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem coordenadores de tomadores"
  ON public.tomador_coordenadores FOR SELECT TO authenticated USING (true);

CREATE POLICY "RH e Admin criam coordenadores de tomadores"
  ON public.tomador_coordenadores FOR INSERT TO authenticated
  WITH CHECK (public.pode_gerenciar_rh(auth.uid()));

CREATE POLICY "RH e Admin editam coordenadores de tomadores"
  ON public.tomador_coordenadores FOR UPDATE TO authenticated
  USING (public.pode_gerenciar_rh(auth.uid()))
  WITH CHECK (public.pode_gerenciar_rh(auth.uid()));

CREATE POLICY "Somente Admin Principal exclui coordenadores de tomadores"
  ON public.tomador_coordenadores FOR DELETE TO authenticated
  USING (public.is_admin_principal(auth.uid()));

CREATE TRIGGER trg_tomador_coordenadores_updated_at
  BEFORE UPDATE ON public.tomador_coordenadores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_tomador_coordenadores_tomador
  ON public.tomador_coordenadores(tomador_id);