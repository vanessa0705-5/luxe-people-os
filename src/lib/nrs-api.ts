import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  BUCKET_SST,
  diasParaVencer,
  formatarData,
  getUrlDocumentoSst,
  somarMeses,
  uploadDocumentoSst,
} from "@/lib/aso-api";

export type NrCatalogo = Database["public"]["Tables"]["nrs_catalogo"]["Row"];
export type NrTreinamento = Database["public"]["Tables"]["nr_treinamentos"]["Row"];
export type NrTreinamentoInsert = Database["public"]["Tables"]["nr_treinamentos"]["Insert"];
export type NrTreinamentoUpdate = Database["public"]["Tables"]["nr_treinamentos"]["Update"];

export { BUCKET_SST, diasParaVencer, formatarData, getUrlDocumentoSst, somarMeses, uploadDocumentoSst };

export type SituacaoTreinamento = "valido" | "a_vencer" | "vencido" | "sem_validade";

export const SITUACAO_TREINAMENTO_LABELS: Record<SituacaoTreinamento, string> = {
  valido: "Válido",
  a_vencer: "A vencer",
  vencido: "Vencido",
  sem_validade: "Sem validade",
};

export function situacaoTreinamento(
  dataValidade: string | null,
  janelaDias = 30,
): SituacaoTreinamento {
  const dias = diasParaVencer(dataValidade);
  if (dias === null) return "sem_validade";
  if (dias < 0) return "vencido";
  if (dias <= janelaDias) return "a_vencer";
  return "valido";
}

export interface NrTreinamentoComRelacoes extends NrTreinamento {
  colaborador: {
    id: string;
    nome_completo: string;
    matricula: string | null;
    cpf: string;
    cargo: string | null;
    departamento: string | null;
    unidade: string | null;
  } | null;
  empresa: { id: string; razao_social: string; nome_fantasia: string | null } | null;
}

const SELECT_TREINAMENTO =
  "*, colaborador:colaboradores(id, nome_completo, matricula, cpf, cargo, departamento, unidade), empresa:empresas(id, razao_social, nome_fantasia)";

export async function listNrsCatalogo(): Promise<NrCatalogo[]> {
  const { data, error } = await supabase
    .from("nrs_catalogo")
    .select("*")
    .eq("is_active", true)
    .order("codigo");
  if (error) throw error;
  return data ?? [];
}

export interface ListTreinamentosParams {
  search?: string;
  nrCodigo?: string | "todos";
  situacao?: SituacaoTreinamento | "todos";
  empresaId?: string | "todos";
  unidade?: string | "todos";
  colaboradorId?: string;
  page?: number;
  pageSize?: number;
}

export interface PagedTreinamentos {
  rows: NrTreinamentoComRelacoes[];
  total: number;
}

export async function listTreinamentosPaged(
  params?: ListTreinamentosParams,
): Promise<PagedTreinamentos> {
  const page = Math.max(1, params?.page ?? 1);
  const pageSize = params?.pageSize ?? 10;

  let query = supabase
    .from("nr_treinamentos")
    .select(SELECT_TREINAMENTO)
    .order("data_realizacao", { ascending: false });

  if (params?.nrCodigo && params.nrCodigo !== "todos")
    query = query.eq("nr_codigo", params.nrCodigo);
  if (params?.empresaId && params.empresaId !== "todos")
    query = query.eq("empresa_id", params.empresaId);
  if (params?.unidade && params.unidade !== "todos") query = query.eq("unidade", params.unidade);
  if (params?.colaboradorId) query = query.eq("colaborador_id", params.colaboradorId);

  const { data, error } = await query;
  if (error) throw error;

  let rows = (data ?? []) as unknown as NrTreinamentoComRelacoes[];

  const search = params?.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter((r) =>
      [
        r.colaborador?.nome_completo,
        r.colaborador?.matricula,
        r.colaborador?.cpf,
        r.nome_treinamento,
        r.nr_codigo,
        r.instrutor,
        r.cargo,
        r.empresa?.razao_social,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(search)),
    );
  }
  if (params?.situacao && params.situacao !== "todos") {
    rows = rows.filter((r) => situacaoTreinamento(r.data_validade) === params.situacao);
  }

  const total = rows.length;
  const from = (page - 1) * pageSize;
  return { rows: rows.slice(from, from + pageSize), total };
}

export interface NrsResumo {
  total: number;
  validos: number;
  aVencer30: number;
  vencidos: number;
  colaboradoresTreinados: number;
  unidades: string[];
  porNr: { codigo: string; total: number; vencidos: number }[];
}

export async function getNrsResumo(): Promise<NrsResumo> {
  const { data, error } = await supabase
    .from("nr_treinamentos")
    .select("nr_codigo, data_validade, unidade, colaborador_id");
  if (error) throw error;
  const rows = data ?? [];

  const mapa = new Map<string, { total: number; vencidos: number }>();
  for (const r of rows) {
    const atual = mapa.get(r.nr_codigo) ?? { total: 0, vencidos: 0 };
    atual.total += 1;
    if (situacaoTreinamento(r.data_validade) === "vencido") atual.vencidos += 1;
    mapa.set(r.nr_codigo, atual);
  }

  return {
    total: rows.length,
    validos: rows.filter((r) => situacaoTreinamento(r.data_validade) === "valido").length,
    aVencer30: rows.filter((r) => situacaoTreinamento(r.data_validade) === "a_vencer").length,
    vencidos: rows.filter((r) => situacaoTreinamento(r.data_validade) === "vencido").length,
    colaboradoresTreinados: new Set(rows.map((r) => r.colaborador_id)).size,
    unidades: Array.from(
      new Set(rows.map((r) => (r.unidade ?? "").trim()).filter((u) => u.length > 0)),
    ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    porNr: Array.from(mapa.entries())
      .map(([codigo, v]) => ({ codigo, ...v }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR")),
  };
}

export async function listTreinamentosDoColaborador(
  colaboradorId: string,
): Promise<NrTreinamentoComRelacoes[]> {
  const { rows } = await listTreinamentosPaged({ colaboradorId, page: 1, pageSize: 200 });
  return rows;
}

export async function createTreinamento(input: NrTreinamentoInsert): Promise<NrTreinamento> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("nr_treinamentos")
    .insert({ ...input, created_by: userData.user?.id ?? null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTreinamento(
  id: string,
  input: NrTreinamentoUpdate,
): Promise<NrTreinamento> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("nr_treinamentos")
    .update({ ...input, updated_by: userData.user?.id ?? null })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTreinamento(
  treinamento: Pick<NrTreinamento, "id" | "certificado_path">,
): Promise<void> {
  const { error } = await supabase.from("nr_treinamentos").delete().eq("id", treinamento.id);
  if (error) throw error;
  if (treinamento.certificado_path) {
    await supabase.storage.from(BUCKET_SST).remove([treinamento.certificado_path]);
  }
}
