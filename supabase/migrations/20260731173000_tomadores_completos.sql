-- Amplia o cadastro de tomadores e cria o vínculo com o coordenador responsável.
ALTER TABLE public.tomadores
  ALTER COLUMN cnpj DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS logradouro text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS uf text;

CREATE TABLE public.tomador_coordenadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tomador_id uuid NOT NULL UNIQUE REFERENCES public.tomadores(id) ON DELETE CASCADE,
  nome_completo text NOT NULL,
  cargo text,
  email text,
  telefone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_tomador_coordenadores_nome
  ON public.tomador_coordenadores(nome_completo);

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
CREATE POLICY "Somente Admin exclui coordenadores de tomadores"
  ON public.tomador_coordenadores FOR DELETE TO authenticated
  USING (public.is_admin_principal(auth.uid()));

CREATE TRIGGER trg_tomador_coordenadores_updated_at
  BEFORE UPDATE ON public.tomador_coordenadores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Carga inicial informada pela usuária. CNPJ e endereço podem ser preenchidos depois.
INSERT INTO public.tomadores (razao_social, nome_fantasia, cnpj, is_active)
SELECT nome, nome, NULL, true
FROM (VALUES
  ('BRACELL - LENÇÓIS PAULISTA'),
  ('PARANAPANEMA'),
  ('PLACO'),
  ('SAINT GOBAIN - MAUÁ'),
  ('EMBRAER'),
  ('BRACELL - PAPEL'),
  ('MOSAIC - UBERABA - MG'),
  ('ARCELORMITTAL - SP'),
  ('ARLANXEO - RS (TSR)'),
  ('CROWN - CABREÚVA'),
  ('MODINE - GUARULHOS'),
  ('TENNECO - SANTO ANDRÉ'),
  ('TITAN'),
  ('WHIRLPOOL - JOINVILLE - SC'),
  ('BRIDGESTONE'),
  ('CORTEVA'),
  ('HEXION - CURITIBA - PR'),
  ('HEXION - MONTENEGRO - RS'),
  ('MOSAIC - CAJATI - SP'),
  ('UNIPAR - CUBATÃO'),
  ('UNIPAR - SANTO ANDRÉ'),
  ('VISCOFAN - GUARULHOS'),
  ('WESTROCK - SP'),
  ('THYSSENKRUPP')
) AS lista(nome)
WHERE NOT EXISTS (
  SELECT 1 FROM public.tomadores t
  WHERE lower(t.razao_social) = lower(lista.nome)
);
