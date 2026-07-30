import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Colaborador = Database["public"]["Tables"]["colaboradores"]["Row"];
export type ColaboradorInsert = Database["public"]["Tables"]["colaboradores"]["Insert"];
export type ColaboradorUpdate = Database["public"]["Tables"]["colaboradores"]["Update"];
export type Dependente = Database["public"]["Tables"]["colaborador_dependentes"]["Row"];
export type DependenteInsert = Database["public"]["Tables"]["colaborador_dependentes"]["Insert"];
export type Tomador = Database["public"]["Tables"]["tomadores"]["Row"];

export type StatusColaborador = "ativo" | "afastado" | "ferias" | "desligado";

export const STATUS_LABELS: Record<StatusColaborador, string> = {
  ativo: "Ativo",
  afastado: "Afastado",
  ferias: "Em Férias",
  desligado: "Desligado",
};

export const TIPO_CONTRATO_LABELS: Record<string, string> = {
  clt: "CLT",
  pj: "PJ",
  temporario: "Temporário",
  estagio: "Estágio",
  terceirizado: "Terceirizado",
};

export const SEXO_LABELS: Record<string, string> = {
  masculino: "Masculino",
  feminino: "Feminino",
  outro: "Outro",
};

export const ESTADO_CIVIL_LABELS: Record<string, string> = {
  solteiro: "Solteiro(a)",
  casado: "Casado(a)",
  divorciado: "Divorciado(a)",
  viuvo: "Viúvo(a)",
  uniao_estavel: "União Estável",
};

export interface ColaboradorComTomador extends Colaborador {
  tomador: Pick<Tomador, "id" | "razao_social" | "cnpj"> | null;
}

export interface ListColaboradoresParams {
  search?: string;
  status?: StatusColaborador | "todos";
  tomadorId?: string | "todos";
  departamento?: string | "todos";
  page?: number;
  pageSize?: number;
}

function applyFilters<T extends { eq: unknown }>(query: T, params?: ListColaboradoresParams): T {
  let q = query as never as {
    eq: (c: string, v: string) => typeof q;
    or: (v: string) => typeof q;
  };
  if (params?.status && params.status !== "todos") q = q.eq("status", params.status);
  if (params?.tomadorId && params.tomadorId !== "todos") q = q.eq("tomador_id", params.tomadorId);
  if (params?.departamento && params.departamento !== "todos")
    q = q.eq("departamento", params.departamento);
  if (params?.search && params.search.trim()) {
    const s = params.search.trim().replace(/[%,]/g, "");
    q = q.or(
      `nome_completo.ilike.%${s}%,cpf.ilike.%${s}%,matricula.ilike.%${s}%,email.ilike.%${s}%`,
    );
  }
  return q as never as T;
}

export interface PagedColaboradores {
  rows: ColaboradorComTomador[];
  total: number;
}

export async function listColaboradoresPaged(
  params?: ListColaboradoresParams,
): Promise<PagedColaboradores> {
  const page = Math.max(1, params?.page ?? 1);
  const pageSize = params?.pageSize ?? 10;
  const from = (page - 1) * pageSize;

  const base = supabase
    .from("colaboradores")
    .select("*, tomador:tomadores(id, razao_social, cnpj)", { count: "exact" })
    .order("nome_completo", { ascending: true })
    .range(from, from + pageSize - 1);

  const { data, error, count } = await applyFilters(base as never, params);
  if (error) throw error;
  return { rows: (data ?? []) as ColaboradorComTomador[], total: count ?? 0 };
}

export interface ColaboradoresResumo {
  total: number;
  ativos: number;
  ferias: number;
  departamentos: string[];
}

export async function getColaboradoresResumo(): Promise<ColaboradoresResumo> {
  const { data, error } = await supabase
    .from("colaboradores")
    .select("status, departamento");
  if (error) throw error;
  const rows = data ?? [];
  const departamentos = Array.from(
    new Set(
      rows
        .map((r) => (r.departamento ?? "").trim())
        .filter((d): d is string => d.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    total: rows.length,
    ativos: rows.filter((r) => r.status === "ativo").length,
    ferias: rows.filter((r) => r.status === "ferias").length,
    departamentos,
  };
}

export async function listColaboradores(
  params?: ListColaboradoresParams,
): Promise<ColaboradorComTomador[]> {
  const { rows } = await listColaboradoresPaged({ ...params, page: 1, pageSize: 1000 });
  return rows;
}


export async function getColaborador(id: string): Promise<ColaboradorComTomador> {
  const { data, error } = await supabase
    .from("colaboradores")
    .select("*, tomador:tomadores(id, razao_social, cnpj)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Colaborador não encontrado");
  return data as ColaboradorComTomador;
}

export async function createColaborador(input: ColaboradorInsert): Promise<Colaborador> {
  const { data, error } = await supabase
    .from("colaboradores")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateColaborador(
  id: string,
  input: ColaboradorUpdate,
): Promise<Colaborador> {
  const { data, error } = await supabase
    .from("colaboradores")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteColaborador(id: string): Promise<void> {
  const { error } = await supabase.from("colaboradores").delete().eq("id", id);
  if (error) throw error;
}

export async function listTomadores(): Promise<Tomador[]> {
  const { data, error } = await supabase
    .from("tomadores")
    .select("*")
    .eq("is_active", true)
    .order("razao_social");
  if (error) throw error;
  return data ?? [];
}

export async function listDependentes(colaboradorId: string): Promise<Dependente[]> {
  const { data, error } = await supabase
    .from("colaborador_dependentes")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .order("data_nascimento", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function createDependente(input: DependenteInsert): Promise<Dependente> {
  const { data, error } = await supabase
    .from("colaborador_dependentes")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDependente(id: string): Promise<void> {
  const { error } = await supabase
    .from("colaborador_dependentes")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
