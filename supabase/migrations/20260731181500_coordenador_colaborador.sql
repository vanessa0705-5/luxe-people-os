-- Vincula o coordenador responsável a um colaborador cadastrado.
ALTER TABLE public.tomador_coordenadores
  ADD COLUMN colaborador_id uuid REFERENCES public.colaboradores(id) ON DELETE SET NULL;

CREATE INDEX idx_tomador_coordenadores_colaborador
  ON public.tomador_coordenadores(colaborador_id);
