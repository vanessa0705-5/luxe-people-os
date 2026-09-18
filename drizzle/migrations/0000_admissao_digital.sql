-- ENUMS
CREATE TYPE public.etapa_admissao AS ENUM ('documentos','transporte','treinamentos','contrato','concluida');
CREATE TYPE public.status_admissao AS ENUM ('aguardando_documentos','documentos_em_validacao','transporte_pendente','treinamentos_pendentes','contrato_pendente','concluida','cancelada');
CREATE TYPE public.status_documento_admissao AS ENUM ('pendente','enviado','em_validacao','aprovado','reprovado');
CREATE TYPE public.modalidade_transporte AS ENUM ('vt','vc','proprio','nenhum');

-- CATALOGO DE DOCUMENTOS ADMISSIONAIS
CREATE TABLE public.admissao_documentos_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  obrigatorio boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admissao_documentos_catalogo TO authenticated;
GRANT ALL ON public.admissao_documentos_catalogo TO service_role;
ALTER TABLE public.admissao_documentos_catalogo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalogo_admissao_select" ON public.admissao_documentos_catalogo FOR SELECT TO authenticated USING (true);
CREATE POLICY "catalogo_admissao_manage" ON public.admissao_documentos_catalogo FOR ALL TO authenticated
  USING (public.pode_gerenciar_rh(auth.uid())) WITH CHECK (public.pode_gerenciar_rh(auth.uid()));
CREATE TRIGGER set_updated_at_admissao_catalogo BEFORE UPDATE ON public.admissao_documentos_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.admissao_documentos_catalogo (codigo, nome, obrigatorio, ordem) VALUES
  ('rg','RG', true, 1),
  ('cpf','CPF', true, 2),
  ('cnh','CNH (quando aplicável)', false, 3),
  ('comprovante_residencia','Comprovante de residência', true, 4),
  ('certidao','Certidão de nascimento/casamento', true, 5),
  ('titulo_eleitor','Título de eleitor', true, 6),
  ('pis','PIS/PASEP/NIT', true, 7),
  ('ctps','Carteira de Trabalho', true, 8),
  ('escolaridade','Comprovante de escolaridade', false, 9),
  ('foto','Foto', true, 10),
  ('dependentes','Documentos de dependentes (quando aplicável)', false, 11),
  ('outros','Outros documentos', false, 12);

-- ADMISSOES
CREATE TABLE public.admissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  nome_completo text NOT NULL,
  cpf text NOT NULL,
  email text,
  telefone text,
  empresa_id uuid REFERENCES public.empresas(id),
  tomador_id uuid REFERENCES public.tomadores(id),
  unidade text,
  cargo text,
  data_prevista date,
  tipo_contrato public.tipo_contrato,
  jornada_semanal integer,
  salario numeric,
  observacoes text,
  etapa public.etapa_admissao NOT NULL DEFAULT 'documentos',
  status public.status_admissao NOT NULL DEFAULT 'aguardando_documentos',
  progresso integer NOT NULL DEFAULT 0,
  colaborador_id uuid REFERENCES public.colaboradores(id),
  link_enviado_em timestamptz,
  concluida_em timestamptz,
  cancelada_em timestamptz,
  motivo_cancelamento text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_admissoes_status ON public.admissoes(status);
CREATE INDEX idx_admissoes_etapa ON public.admissoes(etapa);
CREATE INDEX idx_admissoes_cpf ON public.admissoes(cpf);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admissoes TO authenticated;
GRANT ALL ON public.admissoes TO service_role;
ALTER TABLE public.admissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admissoes_select" ON public.admissoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "admissoes_insert" ON public.admissoes FOR INSERT TO authenticated WITH CHECK (public.pode_gerenciar_rh(auth.uid()));
CREATE POLICY "admissoes_update" ON public.admissoes FOR UPDATE TO authenticated USING (public.pode_gerenciar_rh(auth.uid()));
CREATE POLICY "admissoes_delete" ON public.admissoes FOR DELETE TO authenticated USING (public.is_admin_principal(auth.uid()));
CREATE TRIGGER set_updated_at_admissoes BEFORE UPDATE ON public.admissoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- DOCUMENTOS DA ADMISSAO
CREATE TABLE public.admissao_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admissao_id uuid NOT NULL REFERENCES public.admissoes(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nome text NOT NULL,
  obrigatorio boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  arquivo_path text,
  arquivo_nome text,
  enviado_em timestamptz,
  status public.status_documento_admissao NOT NULL DEFAULT 'pendente',
  observacao text,
  validado_em timestamptz,
  validado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_admissao_documentos_admissao ON public.admissao_documentos(admissao_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admissao_documentos TO authenticated;
GRANT ALL ON public.admissao_documentos TO service_role;
ALTER TABLE public.admissao_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admissao_docs_select" ON public.admissao_documentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "admissao_docs_manage" ON public.admissao_documentos FOR ALL TO authenticated
  USING (public.pode_gerenciar_rh(auth.uid())) WITH CHECK (public.pode_gerenciar_rh(auth.uid()));
CREATE TRIGGER set_updated_at_admissao_documentos BEFORE UPDATE ON public.admissao_documentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TRANSPORTE
CREATE TABLE public.admissao_transporte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admissao_id uuid NOT NULL UNIQUE REFERENCES public.admissoes(id) ON DELETE CASCADE,
  modalidade public.modalidade_transporte NOT NULL DEFAULT 'nenhum',
  linhas text,
  valor_diario numeric,
  placa_veiculo text,
  cnh_numero text,
  observacoes text,
  confirmado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admissao_transporte TO authenticated;
GRANT ALL ON public.admissao_transporte TO service_role;
ALTER TABLE public.admissao_transporte ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admissao_transporte_select" ON public.admissao_transporte FOR SELECT TO authenticated USING (true);
CREATE POLICY "admissao_transporte_manage" ON public.admissao_transporte FOR ALL TO authenticated
  USING (public.pode_gerenciar_rh(auth.uid())) WITH CHECK (public.pode_gerenciar_rh(auth.uid()));
CREATE TRIGGER set_updated_at_admissao_transporte BEFORE UPDATE ON public.admissao_transporte
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TREINAMENTOS NR DA ADMISSAO
CREATE TABLE public.admissao_treinamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admissao_id uuid NOT NULL REFERENCES public.admissoes(id) ON DELETE CASCADE,
  nr_codigo text NOT NULL,
  nome text NOT NULL,
  obrigatorio boolean NOT NULL DEFAULT true,
  concluido_em date,
  carga_horaria numeric,
  instrutor text,
  certificado_path text,
  certificado_nome text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_admissao_treinamentos_admissao ON public.admissao_treinamentos(admissao_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admissao_treinamentos TO authenticated;
GRANT ALL ON public.admissao_treinamentos TO service_role;
ALTER TABLE public.admissao_treinamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admissao_treinamentos_select" ON public.admissao_treinamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "admissao_treinamentos_manage" ON public.admissao_treinamentos FOR ALL TO authenticated
  USING (public.pode_gerenciar_sst(auth.uid()) OR public.pode_gerenciar_rh(auth.uid()))
  WITH CHECK (public.pode_gerenciar_sst(auth.uid()) OR public.pode_gerenciar_rh(auth.uid()));
CREATE TRIGGER set_updated_at_admissao_treinamentos BEFORE UPDATE ON public.admissao_treinamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CONTRATO
CREATE TABLE public.admissao_contrato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admissao_id uuid NOT NULL UNIQUE REFERENCES public.admissoes(id) ON DELETE CASCADE,
  arquivo_path text,
  arquivo_nome text,
  enviado_em timestamptz,
  aceito_em timestamptz,
  assinatura_nome text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admissao_contrato TO authenticated;
GRANT ALL ON public.admissao_contrato TO service_role;
ALTER TABLE public.admissao_contrato ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admissao_contrato_select" ON public.admissao_contrato FOR SELECT TO authenticated USING (true);
CREATE POLICY "admissao_contrato_manage" ON public.admissao_contrato FOR ALL TO authenticated
  USING (public.pode_gerenciar_rh(auth.uid())) WITH CHECK (public.pode_gerenciar_rh(auth.uid()));
CREATE TRIGGER set_updated_at_admissao_contrato BEFORE UPDATE ON public.admissao_contrato
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
