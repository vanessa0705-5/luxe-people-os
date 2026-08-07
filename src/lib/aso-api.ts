import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Aso = Database["public"]["Tables"]["asos"]["Row"];
export type AsoInsert = Database["public"]["Tables"]["asos"]["Insert"];
export type AsoUpdate = Database["public"]["Tables"]["asos"]["Update"];
export type TipoExameAso = Database["public"]["Enums"]["tipo_exame_aso"];
export type ResultadoAso = Database["public"]["Enums"]["resultado_aso"];
export type AsoHistorico = Database["public"]["Tables"]["aso_historico"]["Row"];

export const BUCKET_SST = "documentos-sst";

export const TIPO_EXAME_LABELS: Record<TipoExameAso, string> = {
  admissional: "Admissional",
  periodico: "Periódico",
  retorno_trabalho: "Retorno ao Trabalho",
  mudanca_risco: "Mudança de Risco",
  demissional: "Demissional",
};

export const TIPO_EXAME_ORDER: TipoExameAso[] = [
  "admissional",
  "periodico",
  "retorno_trabalho",
  "mudanca_risco",
  "demissional",
];

export const RESULTADO_LABELS: Record<ResultadoAso, string> = {
  apto: "Apto",
  inapto: "Inapto",
  apto_com_restricao: "Apto com restrição",
};

export const RESULTADO_ORDER: ResultadoAso[] = ["apto", "apto_com_restricao", "inapto"];

/** Validade padrão do exame periódico, em meses. */
export const VALIDADE_PADRAO_MESES = 12;

export type SituacaoAso = "vigente" | "a_vencer" | "vencido" | "sem_vencimento";

export const SITUACAO_ASO_LABELS: Record<SituacaoAso, string> = {
  vigente: "Vigente",
  a_vencer: "A vencer",
  vencido: "Vencido",
  sem_vencimento: "Sem vencimento",
};

export interface AsoComRelacoes extends Aso {
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

const SELECT_ASO =
  "*, colaborador:colaboradores(id, nome_completo, matricula, cpf, cargo, departamento, unidade), empresa:empresas(id, razao_social, nome_fantasia)";

/** Dias restantes até o vencimento (negativo quando vencido). */
export function diasParaVencer(dataVencimento: string | null): number | null {
  if (!dataVencimento) return null;
  const venc = new Date(`${dataVencimento.slice(0, 10)}T00:00:00`).getTime();
  if (Number.isNaN(venc)) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((venc - hoje.getTime()) / 86400000);
}

export function situacaoAso(dataVencimento: string | null, janelaDias = 30): SituacaoAso {
  const dias = diasParaVencer(dataVencimento);
  if (dias === null) return "sem_vencimento";
  if (dias < 0) return "vencido";
  if (dias <= janelaDias) return "a_vencer";
  return "vigente";
}

/** Soma meses a uma data ISO e devolve ISO (yyyy-mm-dd). */
export function somarMeses(dataIso: string, meses: number): string {
  const d = new Date(`${dataIso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const dia = d.getDate();
  d.setMonth(d.getMonth() + meses);
  if (d.getDate() < dia) d.setDate(0);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export interface ListAsosParams {
  search?: string;
  tipoExame?: TipoExameAso | "todos";
  resultado?: ResultadoAso | "todos";
  situacao?: SituacaoAso | "todos";
  empresaId?: string | "todos";
  unidade?: string | "todos";
  colaboradorId?: string;
  page?: number;
  pageSize?: number;
}

export interface PagedAsos {
  rows: AsoComRelacoes[];
  total: number;
}

export async function listAsosPaged(params?: ListAsosParams): Promise<PagedAsos> {
  const page = Math.max(1, params?.page ?? 1);
  const pageSize = params?.pageSize ?? 10;

  let query = supabase
    .from("asos")
    .select(SELECT_ASO)
    .order("data_exame", { ascending: false });

  if (params?.tipoExame && params.tipoExame !== "todos")
    query = query.eq("tipo_exame", params.tipoExame);
  if (params?.resultado && params.resultado !== "todos")
    query = query.eq("resultado", params.resultado);
  if (params?.empresaId && params.empresaId !== "todos")
    query = query.eq("empresa_id", params.empresaId);
  if (params?.unidade && params.unidade !== "todos") query = query.eq("unidade", params.unidade);
  if (params?.colaboradorId) query = query.eq("colaborador_id", params.colaboradorId);

  const { data, error } = await query;
  if (error) throw error;

  let rows = (data ?? []) as unknown as AsoComRelacoes[];

  const search = params?.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter((r) =>
      [
        r.colaborador?.nome_completo,
        r.colaborador?.matricula,
        r.colaborador?.cpf,
        r.matricula,
        r.cpf,
        r.cargo,
        r.clinica,
        r.medico_responsavel,
        r.empresa?.razao_social,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(search)),
    );
  }
  if (params?.situacao && params.situacao !== "todos") {
    rows = rows.filter((r) => situacaoAso(r.data_vencimento) === params.situacao);
  }

  const total = rows.length;
  const from = (page - 1) * pageSize;
  return { rows: rows.slice(from, from + pageSize), total };
}

export interface AsosResumo {
  total: number;
  vencidos: number;
  aVencer30: number;
  aptos: number;
  inaptos: number;
  unidades: string[];
}

export async function getAsosResumo(): Promise<AsosResumo> {
  const { data, error } = await supabase
    .from("asos")
    .select("data_vencimento, resultado, unidade");
  if (error) throw error;
  const rows = data ?? [];
  return {
    total: rows.length,
    vencidos: rows.filter((r) => situacaoAso(r.data_vencimento) === "vencido").length,
    aVencer30: rows.filter((r) => situacaoAso(r.data_vencimento) === "a_vencer").length,
    aptos: rows.filter((r) => r.resultado === "apto" || r.resultado === "apto_com_restricao").length,
    inaptos: rows.filter((r) => r.resultado === "inapto").length,
    unidades: Array.from(
      new Set(rows.map((r) => (r.unidade ?? "").trim()).filter((u) => u.length > 0)),
    ).sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}

export async function listAsosDoColaborador(colaboradorId: string): Promise<AsoComRelacoes[]> {
  const { rows } = await listAsosPaged({ colaboradorId, page: 1, pageSize: 200 });
  return rows;
}

export async function createAso(input: AsoInsert): Promise<Aso> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("asos")
    .insert({ ...input, created_by: userData.user?.id ?? null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAso(id: string, input: AsoUpdate): Promise<Aso> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("asos")
    .update({ ...input, updated_by: userData.user?.id ?? null })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAso(aso: Pick<Aso, "id" | "arquivo_path">): Promise<void> {
  const { error } = await supabase.from("asos").delete().eq("id", aso.id);
  if (error) throw error;
  if (aso.arquivo_path) {
    await supabase.storage.from(BUCKET_SST).remove([aso.arquivo_path]);
  }
}

export async function listHistoricoAso(asoId: string): Promise<AsoHistorico[]> {
  const { data, error } = await supabase
    .from("aso_historico")
    .select("*")
    .eq("aso_id", asoId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Envia o PDF para o bucket privado e devolve o caminho salvo. */
export async function uploadDocumentoSst(
  file: File,
  pasta: string,
): Promise<{ path: string; nome: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const path = `${pasta}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET_SST)
    .upload(path, file, { contentType: file.type || "application/pdf", upsert: false });
  if (error) throw error;
  return { path, nome: file.name };
}

/** Gera uma URL temporária para visualizar/baixar o documento. */
export async function getUrlDocumentoSst(path: string, download = false): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_SST)
    .createSignedUrl(path, 60 * 10, download ? { download: true } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

export function formatarData(value: string | null): string {
  if (!value) return "—";
  const d = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}
