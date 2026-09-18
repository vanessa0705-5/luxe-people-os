import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Admissao = Database["public"]["Tables"]["admissoes"]["Row"];
export type AdmissaoInsert = Database["public"]["Tables"]["admissoes"]["Insert"];
export type AdmissaoUpdate = Database["public"]["Tables"]["admissoes"]["Update"];
export type AdmissaoDocumento = Database["public"]["Tables"]["admissao_documentos"]["Row"];
export type AdmissaoTransporte = Database["public"]["Tables"]["admissao_transporte"]["Row"];
export type AdmissaoTreinamento = Database["public"]["Tables"]["admissao_treinamentos"]["Row"];
export type AdmissaoContrato = Database["public"]["Tables"]["admissao_contrato"]["Row"];
export type EtapaAdmissao = Database["public"]["Enums"]["etapa_admissao"];
export type StatusAdmissao = Database["public"]["Enums"]["status_admissao"];
export type StatusDocumentoAdmissao = Database["public"]["Enums"]["status_documento_admissao"];
export type ModalidadeTransporte = Database["public"]["Enums"]["modalidade_transporte"];

export const BUCKET_ADMISSAO = "admissao-documentos";

export const ETAPAS: EtapaAdmissao[] = [
  "documentos",
  "transporte",
  "treinamentos",
  "contrato",
  "concluida",
];

export const ETAPA_LABELS: Record<EtapaAdmissao, string> = {
  documentos: "Documentos",
  transporte: "Transporte",
  treinamentos: "Treinamentos NR",
  contrato: "Contrato",
  concluida: "Concluída",
};

export const STATUS_ADMISSAO_LABELS: Record<StatusAdmissao, string> = {
  aguardando_documentos: "Aguardando documentos",
  documentos_em_validacao: "Documentos em validação",
  transporte_pendente: "Transporte pendente",
  treinamentos_pendentes: "Treinamentos pendentes",
  contrato_pendente: "Contrato pendente",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const STATUS_DOC_LABELS: Record<StatusDocumentoAdmissao, string> = {
  pendente: "Pendente",
  enviado: "Enviado",
  em_validacao: "Em validação",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
};

export const MODALIDADE_LABELS: Record<ModalidadeTransporte, string> = {
  vt: "Vale-transporte (VT)",
  vc: "Vale-combustível (VC)",
  proprio: "Transporte próprio",
  nenhum: "Não utiliza",
};

export function progressoPorEtapa(etapa: EtapaAdmissao): number {
  const i = ETAPAS.indexOf(etapa);
  return Math.round((i / (ETAPAS.length - 1)) * 100);
}

export function statusPorEtapa(etapa: EtapaAdmissao): StatusAdmissao {
  switch (etapa) {
    case "documentos":
      return "aguardando_documentos";
    case "transporte":
      return "transporte_pendente";
    case "treinamentos":
      return "treinamentos_pendentes";
    case "contrato":
      return "contrato_pendente";
    default:
      return "concluida";
  }
}

export function formatarData(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
  return d.toLocaleDateString("pt-BR");
}

export function gerarToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function linkCandidato(token: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/admissao/${token}`;
}

export interface AdmissaoComRelacoes extends Admissao {
  empresa: { id: string; razao_social: string; nome_fantasia: string | null } | null;
  tomador: { id: string; razao_social: string; cnpj: string } | null;
}

const SELECT_ADMISSAO =
  "*, empresa:empresas(id, razao_social, nome_fantasia), tomador:tomadores(id, razao_social, cnpj)";

export interface ListAdmissoesParams {
  search?: string;
  status?: StatusAdmissao | "todos";
  etapa?: EtapaAdmissao | "todos";
  empresaId?: string | "todos";
  tomadorId?: string | "todos";
  cargo?: string | "todos";
  de?: string;
  ate?: string;
  page?: number;
  pageSize?: number;
}

export async function listAdmissoesPaged(
  params?: ListAdmissoesParams,
): Promise<{ rows: AdmissaoComRelacoes[]; total: number }> {
  const page = Math.max(1, params?.page ?? 1);
  const pageSize = params?.pageSize ?? 10;
  const from = (page - 1) * pageSize;

  let query = supabase
    .from("admissoes")
    .select(SELECT_ADMISSAO, { count: "exact" })
    .order("created_at", { ascending: false });

  if (params?.status && params.status !== "todos") query = query.eq("status", params.status);
  if (params?.etapa && params.etapa !== "todos") query = query.eq("etapa", params.etapa);
  if (params?.empresaId && params.empresaId !== "todos")
    query = query.eq("empresa_id", params.empresaId);
  if (params?.tomadorId && params.tomadorId !== "todos")
    query = query.eq("tomador_id", params.tomadorId);
  if (params?.cargo && params.cargo !== "todos") query = query.eq("cargo", params.cargo);
  if (params?.de) query = query.gte("data_prevista", params.de);
  if (params?.ate) query = query.lte("data_prevista", params.ate);
  if (params?.search && params.search.trim()) {
    const s = params.search.trim().replace(/[%,()]/g, "");
    query = query.or(`nome_completo.ilike.%${s}%,cpf.ilike.%${s}%,email.ilike.%${s}%`);
  }

  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as AdmissaoComRelacoes[], total: count ?? 0 };
}

export async function listAdmissoesKanban(): Promise<AdmissaoComRelacoes[]> {
  const { data, error } = await supabase
    .from("admissoes")
    .select(SELECT_ADMISSAO)
    .neq("status", "cancelada")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []) as unknown as AdmissaoComRelacoes[];
}

export interface AdmissoesResumo {
  total: number;
  emAndamento: number;
  aguardandoDocumentos: number;
  documentosEmValidacao: number;
  transportePendente: number;
  treinamentosPendentes: number;
  contratosPendentes: number;
  concluidas: number;
  canceladas: number;
  cargos: string[];
}

export async function getAdmissoesResumo(): Promise<AdmissoesResumo> {
  const { data, error } = await supabase.from("admissoes").select("status, cargo");
  if (error) throw error;
  const rows = data ?? [];
  const by = (s: StatusAdmissao) => rows.filter((r) => r.status === s).length;
  const concluidas = by("concluida");
  const canceladas = by("cancelada");
  return {
    total: rows.length,
    emAndamento: rows.length - concluidas - canceladas,
    aguardandoDocumentos: by("aguardando_documentos"),
    documentosEmValidacao: by("documentos_em_validacao"),
    transportePendente: by("transporte_pendente"),
    treinamentosPendentes: by("treinamentos_pendentes"),
    contratosPendentes: by("contrato_pendente"),
    concluidas,
    canceladas,
    cargos: Array.from(
      new Set(rows.map((r) => (r.cargo ?? "").trim()).filter((c) => c.length > 0)),
    ).sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}

export async function listCatalogoDocumentos() {
  const { data, error } = await supabase
    .from("admissao_documentos_catalogo")
    .select("*")
    .order("ordem");
  if (error) throw error;
  return data ?? [];
}

export async function atualizarCatalogoDocumento(
  id: string,
  input: { obrigatorio?: boolean; is_active?: boolean },
) {
  const { error } = await supabase
    .from("admissao_documentos_catalogo")
    .update(input)
    .eq("id", id);
  if (error) throw error;
}

export async function createAdmissao(
  input: Omit<AdmissaoInsert, "token">,
): Promise<Admissao> {
  const token = gerarToken();
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("admissoes")
    .insert({ ...input, token, created_by: user.user?.id ?? null })
    .select()
    .single();
  if (error) throw error;

  const catalogo = await listCatalogoDocumentos();
  const docs = catalogo
    .filter((c) => c.is_active)
    .map((c) => ({
      admissao_id: data.id,
      codigo: c.codigo,
      nome: c.nome,
      obrigatorio: c.obrigatorio,
      ordem: c.ordem,
    }));
  if (docs.length) {
    const { error: e2 } = await supabase.from("admissao_documentos").insert(docs);
    if (e2) throw e2;
  }
  return data;
}

export async function updateAdmissao(id: string, input: AdmissaoUpdate): Promise<Admissao> {
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("admissoes")
    .update({ ...input, updated_by: user.user?.id ?? null })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function cancelarAdmissao(id: string, motivo: string): Promise<void> {
  const { error } = await supabase
    .from("admissoes")
    .update({
      status: "cancelada",
      cancelada_em: new Date().toISOString(),
      motivo_cancelamento: motivo,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function marcarLinkEnviado(id: string): Promise<void> {
  const { error } = await supabase
    .from("admissoes")
    .update({ link_enviado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function getAdmissao(id: string): Promise<AdmissaoComRelacoes> {
  const { data, error } = await supabase
    .from("admissoes")
    .select(SELECT_ADMISSAO)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Admissão não encontrada");
  return data as unknown as AdmissaoComRelacoes;
}

export async function listDocumentosAdmissao(admissaoId: string): Promise<AdmissaoDocumento[]> {
  const { data, error } = await supabase
    .from("admissao_documentos")
    .select("*")
    .eq("admissao_id", admissaoId)
    .order("ordem");
  if (error) throw error;
  return data ?? [];
}

export async function validarDocumento(
  id: string,
  status: StatusDocumentoAdmissao,
  observacao?: string,
): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("admissao_documentos")
    .update({
      status,
      observacao: observacao ?? null,
      validado_em: new Date().toISOString(),
      validado_por: user.user?.id ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function getUrlDocumentoAdmissao(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET_ADMISSAO)
    .createSignedUrl(path, 60 * 10);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function getTransporte(admissaoId: string): Promise<AdmissaoTransporte | null> {
  const { data, error } = await supabase
    .from("admissao_transporte")
    .select("*")
    .eq("admissao_id", admissaoId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listTreinamentosAdmissao(
  admissaoId: string,
): Promise<AdmissaoTreinamento[]> {
  const { data, error } = await supabase
    .from("admissao_treinamentos")
    .select("*")
    .eq("admissao_id", admissaoId)
    .order("nr_codigo");
  if (error) throw error;
  return data ?? [];
}

export async function definirTreinamentos(
  admissaoId: string,
  itens: { nr_codigo: string; nome: string }[],
): Promise<void> {
  await supabase.from("admissao_treinamentos").delete().eq("admissao_id", admissaoId);
  if (!itens.length) return;
  const { error } = await supabase
    .from("admissao_treinamentos")
    .insert(itens.map((i) => ({ ...i, admissao_id: admissaoId })));
  if (error) throw error;
}

export async function concluirTreinamento(id: string, data_conclusao: string): Promise<void> {
  const { error } = await supabase
    .from("admissao_treinamentos")
    .update({ concluido_em: data_conclusao })
    .eq("id", id);
  if (error) throw error;
}

export async function getContrato(admissaoId: string): Promise<AdmissaoContrato | null> {
  const { data, error } = await supabase
    .from("admissao_contrato")
    .select("*")
    .eq("admissao_id", admissaoId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function avancarEtapa(id: string, etapa: EtapaAdmissao): Promise<void> {
  const { error } = await supabase
    .from("admissoes")
    .update({
      etapa,
      status: statusPorEtapa(etapa),
      progresso: progressoPorEtapa(etapa),
      ...(etapa === "concluida" ? { concluida_em: new Date().toISOString() } : {}),
    })
    .eq("id", id);
  if (error) throw error;
}
