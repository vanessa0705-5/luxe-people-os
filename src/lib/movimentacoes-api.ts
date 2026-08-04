import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Movimentacao = Database["public"]["Tables"]["movimentacoes"]["Row"];
export type MovimentacaoInsert = Database["public"]["Tables"]["movimentacoes"]["Insert"];
export type MovimentacaoUpdate = Database["public"]["Tables"]["movimentacoes"]["Update"];
export type TipoMovimentacao = Database["public"]["Enums"]["tipo_movimentacao"];
export type StatusColaborador = Database["public"]["Enums"]["status_colaborador"];

export const TIPO_MOV_LABELS: Record<TipoMovimentacao, string> = {
  admissao: "Admissão",
  promocao: "Promoção",
  alteracao_salarial: "Alteração salarial",
  transferencia: "Transferência",
  afastamento: "Afastamento",
  retorno: "Retorno ao trabalho",
  desligamento: "Desligamento",
};

export const TIPO_MOV_ORDER: TipoMovimentacao[] = [
  "admissao",
  "promocao",
  "alteracao_salarial",
  "transferencia",
  "afastamento",
  "retorno",
  "desligamento",
];

/** Situação aplicada automaticamente ao colaborador conforme o tipo. */
export const STATUS_SUGERIDO: Partial<Record<TipoMovimentacao, StatusColaborador>> = {
  admissao: "ativo",
  afastamento: "afastado",
  retorno: "ativo",
  desligamento: "desligado",
};

export interface MovimentacaoComColaborador extends Movimentacao {
  colaborador: {
    id: string;
    nome_completo: string;
    matricula: string | null;
    cargo: string | null;
    departamento: string | null;
    email: string | null;
    cpf: string;
  } | null;
  tomador_novo: { id: string; razao_social: string } | null;
  tomador_anterior: { id: string; razao_social: string } | null;
}

const SELECT_FULL =
  "*, colaborador:colaboradores!movimentacoes_colaborador_id_fkey(id, nome_completo, matricula, cargo, departamento, email, cpf), tomador_novo:tomadores!movimentacoes_tomador_novo_id_fkey(id, razao_social), tomador_anterior:tomadores!movimentacoes_tomador_anterior_id_fkey(id, razao_social)";

export interface ListMovimentacoesParams {
  search?: string;
  tipo?: TipoMovimentacao | "todos";
  departamento?: string | "todos";
  colaboradorId?: string;
  page?: number;
  pageSize?: number;
}

export interface PagedMovimentacoes {
  rows: MovimentacaoComColaborador[];
  total: number;
}

export async function listMovimentacoesPaged(
  params?: ListMovimentacoesParams,
): Promise<PagedMovimentacoes> {
  const page = Math.max(1, params?.page ?? 1);
  const pageSize = params?.pageSize ?? 10;
  const from = (page - 1) * pageSize;

  let query = supabase
    .from("movimentacoes")
    .select(SELECT_FULL, { count: "exact" })
    .order("data_efeito", { ascending: false })
    .order("created_at", { ascending: false });

  if (params?.tipo && params.tipo !== "todos") query = query.eq("tipo", params.tipo);
  if (params?.colaboradorId) query = query.eq("colaborador_id", params.colaboradorId);

  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;

  let rows = (data ?? []) as unknown as MovimentacaoComColaborador[];

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

export interface MovimentacoesResumo {
  total: number;
  mes: number;
  promocoes: number;
  desligamentos: number;
}

export async function getMovimentacoesResumo(): Promise<MovimentacoesResumo> {
  const { data, error } = await supabase.from("movimentacoes").select("tipo, data_efeito");
  if (error) throw error;
  const rows = data ?? [];
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  return {
    total: rows.length,
    mes: rows.filter((r) => (r.data_efeito ?? "").startsWith(mesAtual)).length,
    promocoes: rows.filter((r) => r.tipo === "promocao").length,
    desligamentos: rows.filter((r) => r.tipo === "desligamento").length,
  };
}

export async function listMovimentacoesDoColaborador(
  colaboradorId: string,
): Promise<MovimentacaoComColaborador[]> {
  const { rows } = await listMovimentacoesPaged({ colaboradorId, page: 1, pageSize: 200 });
  return rows;
}

export async function createMovimentacao(input: MovimentacaoInsert): Promise<Movimentacao> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("movimentacoes")
    .insert({ ...input, created_by: userData.user?.id ?? null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMovimentacao(
  id: string,
  input: MovimentacaoUpdate,
): Promise<Movimentacao> {
  const { data, error } = await supabase
    .from("movimentacoes")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMovimentacao(id: string): Promise<void> {
  const { error } = await supabase.from("movimentacoes").delete().eq("id", id);
  if (error) throw error;
}

export function formatarData(value: string | null): string {
  if (!value) return "—";
  const d = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export function formatarMoeda(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Descreve, em texto, a mudança registrada na movimentação. */
export function resumirMudanca(m: MovimentacaoComColaborador): string {
  const partes: string[] = [];
  if (m.cargo_novo && m.cargo_novo !== m.cargo_anterior)
    partes.push(`Cargo: ${m.cargo_anterior ?? "—"} → ${m.cargo_novo}`);
  if (m.funcao_nova && m.funcao_nova !== m.funcao_anterior)
    partes.push(`Função: ${m.funcao_anterior ?? "—"} → ${m.funcao_nova}`);
  if (m.salario_novo !== null && m.salario_novo !== m.salario_anterior)
    partes.push(
      `Salário: ${formatarMoeda(m.salario_anterior)} → ${formatarMoeda(m.salario_novo)}`,
    );
  if (m.departamento_novo && m.departamento_novo !== m.departamento_anterior)
    partes.push(`Departamento: ${m.departamento_anterior ?? "—"} → ${m.departamento_novo}`);
  if (m.tomador_novo && m.tomador_novo_id !== m.tomador_anterior_id)
    partes.push(`Tomador: ${m.tomador_anterior?.razao_social ?? "—"} → ${m.tomador_novo.razao_social}`);
  if (m.status_novo && m.status_novo !== m.status_anterior)
    partes.push(`Situação: ${m.status_anterior ?? "—"} → ${m.status_novo}`);
  return partes.length ? partes.join(" · ") : "Sem alterações cadastrais";
}
