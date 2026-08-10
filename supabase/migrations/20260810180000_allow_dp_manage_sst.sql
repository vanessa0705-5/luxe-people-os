-- Permite que o Departamento Pessoal cadastre ASO, NR e seus anexos.
CREATE OR REPLACE FUNCTION public.pode_gerenciar_sst(_user_id uuid)
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
      AND role::text IN (
        'admin_principal',
        'rh',
        'departamento_pessoal',
        'seguranca_trabalho'
      )
  )
$$;
