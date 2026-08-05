import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Ferias = Database["public"]["Tables"]["ferias"]["Row"];
export type FeriasInsert = Database["public"]["Tables"]["ferias"]["Insert"];
export type FeriasUpdate = Database["public"]["Tables"]["ferias"]["Update"];
export type StatusFerias = Database["public"]["Enums"]["status_ferias"];

export const STATUS_FERIAS_LABELS: Record<StatusFerias, string> = {
  solicitada: "Solicitada",
  aprovada: "Aprovada",
  reprovada: "Reprovada",
  em_gozo: "Em gozo",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const STATUS_FERIAS_ORDER: StatusFerias[] = [
  "solicitada",
  "aprovada",
  "em_gozo",
  "concluida",
  "reprovada",
  "cancelada",
];

export interface FeriasComColaborador extends Ferias {
  colaborador: {
    id: string;
    nome_completo: string;
    matricula: string | null;
    cargo: string | null;
    departamento: string | null;
    email: string | null;
    cpf: string;
    tomador_id: string | null;
  } | null;
}

const SELECT_WITH_COLAB =
  "*, colaborador:colaboradores(id, nome_completo, matricula, cargo, departamento, email, cpf, tomador_id)";

export interface ListFeriasParams {
  search?: string;
  status?: StatusFerias | "todos";
  departamento?: string | "todos";
  colaboradorId?: string;
  page?: number;
  pageSize?: number;
}

export interface PagedFerias {
  rows: FeriasComColaborador[];
  total: number;
}

export async function listFeriasPaged(params?: ListFeriasParams): Promise<PagedFerias> {
  const page = Math.max(1, params?.page ?? 1);
  const pageSize = params?.pageSize ?? 10;
  const from = (page - 1) * pageSize;

  let query = supabase
    .from("ferias")
    .select(SELECT_WITH_COLAB, { count: "exact" })
    .order("data_inicio", { ascending: false });

  if (params?.status && params.status !== "todos") query = query.eq("status", params.status);
  if (params?.colaboradorId) query = query.eq("colaborador_id", params.colaboradorId);

  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;

  let rows = (data ?? []) as unknown as FeriasComColaborador[];

  // Filtros que dependem dos dados do colaborador (relacionamento aninhado)
  const search = params?.search?.trim().toLowerCase();
  const dep = params?.departamento;
  if (search || (dep && dep !== "todos")) {
    rows = rows.filter((r) => {
      const c = r.colaborador;
      const okDep = !dep || dep === "todos" || (c?.departamento ?? "") === dep;
      const okSearch =
        !search ||
        [c?.nome_completo, c?.matricula, c?.cpf, c?.email]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(search));
      return okDep && okSearch;
    });
  }

  return { rows, total: count ?? 0 };
}

export interface FeriasResumo {
  total: number;
  solicitadas: number;
  emGozo: number;
  proximas30: number;
}

export async function getFeriasResumo(): Promise<FeriasResumo> {
  const { data, error } = await supabase.from("ferias").select("status, data_inicio");
  if (error) throw error;
  const rows = data ?? [];
  const hoje = new Date();
  const limite = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    total: rows.length,
    solicitadas: rows.filter((r) => r.status === "solicitada").length,
    emGozo: rows.filter((r) => r.status === "em_gozo").length,
    proximas30: rows.filter((r) => {
      const d = new Date(`${r.data_inicio}T00:00:00`);
      return d >= hoje && d <= limite;
    }).length,
  };
}

export async function listFeriasDoColaborador(
  colaboradorId: string,
): Promise<FeriasComColaborador[]> {
  const { rows } = await listFeriasPaged({ colaboradorId, page: 1, pageSize: 200 });
  return rows;
}

export async function createFerias(input: FeriasInsert): Promise<Ferias> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("ferias")
    .insert({ ...input, solicitado_por: userData.user?.id ?? null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateFerias(id: string, input: FeriasUpdate): Promise<Ferias> {
  const { data, error } = await supabase
    .from("ferias")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function decidirFerias(
  id: string,
  decisao: "aprovada" | "reprovada",
  motivo?: string,
): Promise<Ferias> {
  const { data: userData } = await supabase.auth.getUser();
  return updateFerias(id, {
    status: decisao,
    aprovado_por: userData.user?.id ?? null,
    aprovado_em: new Date().toISOString(),
    motivo_reprovacao: decisao === "reprovada" ? (motivo ?? null) : null,
  });
}

export async function deleteFerias(id: string): Promise<void> {
  const { error } = await supabase.from("ferias").delete().eq("id", id);
  if (error) throw error;
}

/** Calcula dias (inclusivo) entre duas datas ISO (yyyy-mm-dd). */
export function calcularDias(inicio: string, fim: string): number {
  if (!inicio || !fim) return 0;
  const a = new Date(`${inicio}T00:00:00`).getTime();
  const b = new Date(`${fim}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

function toIso(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Sugere o período aquisitivo a partir da data de admissão.
 * Retorna o último período completo de 12 meses; se ainda não houver período
 * completo, devolve o período em curso (primeiro ano de vínculo).
 */
export function periodoAquisitivoSugerido(
  dataAdmissao: string | null | undefined,
  referencia: Date = new Date(),
): { inicio: string; fim: string } | null {
  if (!dataAdmissao) return null;
  const admissao = new Date(`${dataAdmissao.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(admissao.getTime())) return null;

  let anos = referencia.getFullYear() - admissao.getFullYear();
  const aniversario = new Date(admissao);
  aniversario.setFullYear(admissao.getFullYear() + anos);
  if (aniversario.getTime() > referencia.getTime()) anos -= 1;
  const completos = Math.max(anos, 0);

  const inicio = new Date(admissao);
  inicio.setFullYear(admissao.getFullYear() + Math.max(completos - 1, 0));
  const fim = new Date(inicio);
  fim.setFullYear(inicio.getFullYear() + 1);
  fim.setDate(fim.getDate() - 1);

  return { inicio: toIso(inicio), fim: toIso(fim) };
}


export function formatarData(value: string | null): string {
  if (!value) return "—";
  const d = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}
