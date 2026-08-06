import { supabase } from "@/integrations/supabase/client";
import type { ColaboradorComTomador } from "@/lib/colaboradores-api";
import { createMovimentacao } from "@/lib/movimentacoes-api";

export interface ListDesligadosParams {
  search?: string;
  departamento?: string | "todos";
  tomadorId?: string | "todos";
  /** Ano do desligamento (yyyy) ou "todos". */
  ano?: string | "todos";
  page?: number;
  pageSize?: number;
}

export interface PagedDesligados {
  rows: DesligadoComMotivo[];
  total: number;
}

export interface DesligadoComMotivo extends ColaboradorComTomador {
  /** Dados da movimentação de desligamento, quando registrada. */
  desligamento: {
    id: string;
    data_efeito: string;
    motivo: string | null;
    observacoes: string | null;
  } | null;
}

const SELECT = "*, tomador:tomadores(id, razao_social, cnpj)";

export async function listDesligadosPaged(
  params?: ListDesligadosParams,
): Promise<PagedDesligados> {
  const page = Math.max(1, params?.page ?? 1);
  const pageSize = params?.pageSize ?? 10;
  const from = (page - 1) * pageSize;

  let query = supabase
    .from("colaboradores")
    .select(SELECT, { count: "exact" })
    .eq("status", "desligado")
    .order("data_desligamento", { ascending: false, nullsFirst: false })
    .order("nome_completo", { ascending: true });

  if (params?.departamento && params.departamento !== "todos")
    query = query.eq("departamento", params.departamento);
  if (params?.tomadorId && params.tomadorId !== "todos")
    query = query.eq("tomador_id", params.tomadorId);
  if (params?.ano && params.ano !== "todos")
    query = query
      .gte("data_desligamento", `${params.ano}-01-01`)
      .lte("data_desligamento", `${params.ano}-12-31`);
  if (params?.search && params.search.trim()) {
    const s = params.search.trim().replace(/[%,()]/g, "");
    query = query.or(
      `nome_completo.ilike.%${s}%,cpf.ilike.%${s}%,matricula.ilike.%${s}%,email.ilike.%${s}%`,
    );
  }

  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;

  const base = (data ?? []) as unknown as ColaboradorComTomador[];
  if (base.length === 0) return { rows: [], total: count ?? 0 };

  const { data: movs } = await supabase
    .from("movimentacoes")
    .select("id, colaborador_id, data_efeito, motivo, observacoes")
    .eq("tipo", "desligamento")
    .in(
      "colaborador_id",
      base.map((c) => c.id),
    )
    .order("data_efeito", { ascending: false });

  const rows: DesligadoComMotivo[] = base.map((c) => {
    const m = (movs ?? []).find((x) => x.colaborador_id === c.id);
    return {
      ...c,
      desligamento: m
        ? {
            id: m.id,
            data_efeito: m.data_efeito,
            motivo: m.motivo,
            observacoes: m.observacoes,
          }
        : null,
    };
  });

  return { rows, total: count ?? 0 };
}

export interface DesligadosResumo {
  total: number;
  mes: number;
  ano: number;
  /** Tempo médio de casa, em meses. */
  permanenciaMediaMeses: number;
  anos: string[];
}

export async function getDesligadosResumo(): Promise<DesligadosResumo> {
  const { data, error } = await supabase
    .from("colaboradores")
    .select("data_admissao, data_desligamento")
    .eq("status", "desligado");
  if (error) throw error;
  const rows = data ?? [];
  const hoje = new Date();
  const anoAtual = String(hoje.getFullYear());
  const mesAtual = `${anoAtual}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  const duracoes = rows
    .filter((r) => r.data_admissao && r.data_desligamento)
    .map((r) => {
      const a = new Date(`${r.data_admissao!}T00:00:00`).getTime();
      const d = new Date(`${r.data_desligamento!}T00:00:00`).getTime();
      return (d - a) / (1000 * 60 * 60 * 24 * 30.4375);
    })
    .filter((n) => Number.isFinite(n) && n >= 0);

  const anos = Array.from(
    new Set(rows.map((r) => (r.data_desligamento ?? "").slice(0, 4)).filter(Boolean)),
  ).sort((a, b) => b.localeCompare(a));

  return {
    total: rows.length,
    mes: rows.filter((r) => (r.data_desligamento ?? "").startsWith(mesAtual)).length,
    ano: rows.filter((r) => (r.data_desligamento ?? "").startsWith(anoAtual)).length,
    permanenciaMediaMeses: duracoes.length
      ? Math.round(duracoes.reduce((s, n) => s + n, 0) / duracoes.length)
      : 0,
    anos,
  };
}

export interface RegistrarDesligamentoInput {
  colaboradorId: string;
  dataEfeito: string;
  motivo: string;
  observacoes?: string;
}

/** Registra o desligamento como movimentação; a trigger atualiza o cadastro. */
export async function registrarDesligamento(input: RegistrarDesligamentoInput) {
  return createMovimentacao({
    colaborador_id: input.colaboradorId,
    tipo: "desligamento",
    data_efeito: input.dataEfeito,
    motivo: input.motivo || null,
    observacoes: input.observacoes || null,
    status_novo: "desligado",
  });
}

/** Readmite o colaborador registrando uma movimentação de admissão. */
export async function readmitirColaborador(colaboradorId: string, dataEfeito: string) {
  await createMovimentacao({
    colaborador_id: colaboradorId,
    tipo: "admissao",
    data_efeito: dataEfeito,
    motivo: "Readmissão",
    status_novo: "ativo",
  });
  const { error } = await supabase
    .from("colaboradores")
    .update({ data_desligamento: null })
    .eq("id", colaboradorId);
  if (error) throw error;
}

export function permanenciaTexto(
  dataAdmissao: string | null,
  dataDesligamento: string | null,
): string {
  if (!dataAdmissao || !dataDesligamento) return "—";
  const a = new Date(`${dataAdmissao}T00:00:00`).getTime();
  const d = new Date(`${dataDesligamento}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(d) || d < a) return "—";
  const meses = Math.floor((d - a) / (1000 * 60 * 60 * 24 * 30.4375));
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  if (anos === 0) return `${resto} ${resto === 1 ? "mês" : "meses"}`;
  return resto === 0 ? `${anos} ano(s)` : `${anos} ano(s) e ${resto} ${resto === 1 ? "mês" : "meses"}`;
}

/** Gera o CSV dos desligados para exportação. */
export function desligadosParaCsv(rows: DesligadoComMotivo[]): string {
  const head = [
    "Nome",
    "CPF",
    "Matrícula",
    "Cargo",
    "Departamento",
    "Tomador",
    "Admissão",
    "Desligamento",
    "Permanência",
    "Motivo",
  ];
  const linhas = rows.map((r) =>
    [
      r.nome_completo,
      r.cpf,
      r.matricula ?? "",
      r.cargo ?? "",
      r.departamento ?? "",
      r.tomador?.razao_social ?? "",
      r.data_admissao ?? "",
      r.data_desligamento ?? "",
      permanenciaTexto(r.data_admissao, r.data_desligamento),
      r.desligamento?.motivo ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(";"),
  );
  return [head.join(";"), ...linhas].join("\n");
}
