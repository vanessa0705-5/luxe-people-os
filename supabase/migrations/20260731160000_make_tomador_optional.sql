-- Permite cadastrar e editar colaboradores sem vínculo com um tomador.
ALTER TABLE public.colaboradores
ALTER COLUMN tomador_id DROP NOT NULL;
