-- Garante o armazenamento privado usado pelos anexos de ASO e NR.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos-sst',
  'documentos-sst',
  false,
  20971520,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Reaplica a função de auditoria como SECURITY DEFINER para que o histórico
-- não bloqueie o INSERT/UPDATE do ASO por causa das políticas da tabela de auditoria.
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
