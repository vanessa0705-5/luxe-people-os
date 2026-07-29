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

export async function listColaboradores(params?: {
  search?: string;
  status?: StatusColaborador | "todos";
  tomadorId?: string | "todos";
}): Promise<ColaboradorComTomador[]> {
  let query = supabase
    .from("colaboradores")
    .select("*, tomador:tomadores(id, razao_social, cnpj)")
    .order("nome_completo", { ascending: true });

  if (params?.status && params.status !== "todos") {
    query = query.eq("status", params.status);
  }
  if (params?.tomadorId && params.tomadorId !== "todos") {
    query = query.eq("tomador_id", params.tomadorId);
  }
  if (params?.search && params.search.trim()) {
    const s = params.search.trim();
    query = query.or(
      `nome_completo.ilike.%${s}%,cpf.ilike.%${s}%,matricula.ilike.%${s}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ColaboradorComTomador[];
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
