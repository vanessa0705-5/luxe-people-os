import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Empresa = Database["public"]["Tables"]["empresas"]["Row"];
export type EmpresaInsert = Database["public"]["Tables"]["empresas"]["Insert"];
export type EmpresaUpdate = Database["public"]["Tables"]["empresas"]["Update"];
export type StatusEmpresa = "ativa" | "inativa";

export const STATUS_EMPRESA_LABELS: Record<StatusEmpresa, string> = {
  ativa: "Ativa",
  inativa: "Inativa",
};

export interface ListEmpresasParams {
  search?: string;
  status?: StatusEmpresa | "todos";
  uf?: string | "todos";
  page?: number;
  pageSize?: number;
}

export interface PagedEmpresas {
  rows: Empresa[];
  total: number;
}

export async function listEmpresasPaged(params?: ListEmpresasParams): Promise<PagedEmpresas> {
  const page = Math.max(1, params?.page ?? 1);
  const pageSize = params?.pageSize ?? 10;
  const from = (page - 1) * pageSize;

  let query = supabase
    .from("empresas")
    .select("*", { count: "exact" })
    .order("razao_social", { ascending: true });

  if (params?.status && params.status !== "todos") query = query.eq("status", params.status);
  if (params?.uf && params.uf !== "todos") query = query.eq("uf", params.uf);
  if (params?.search && params.search.trim()) {
    const s = params.search.trim().replace(/[%,()]/g, "");
    query = query.or(
      `razao_social.ilike.%${s}%,nome_fantasia.ilike.%${s}%,cnpj.ilike.%${s}%`,
    );
  }

  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;
  return { rows: (data ?? []) as Empresa[], total: count ?? 0 };
}

export interface EmpresasResumo {
  total: number;
  ativas: number;
  inativas: number;
  tomadoresVinculados: number;
  ufs: string[];
}

export async function getEmpresasResumo(): Promise<EmpresasResumo> {
  const [{ data: empresas, error }, { count: tomadoresCount, error: errTom }] = await Promise.all([
    supabase.from("empresas").select("status, uf"),
    supabase
      .from("tomadores")
      .select("id", { count: "exact", head: true })
      .not("empresa_id", "is", null),
  ]);
  if (error) throw error;
  if (errTom) throw errTom;
  const rows = empresas ?? [];
  const ufs = Array.from(
    new Set(rows.map((r) => (r.uf ?? "").trim().toUpperCase()).filter((u) => u.length === 2)),
  ).sort();
  return {
    total: rows.length,
    ativas: rows.filter((r) => r.status === "ativa").length,
    inativas: rows.filter((r) => r.status === "inativa").length,
    tomadoresVinculados: tomadoresCount ?? 0,
    ufs,
  };
}

export async function getEmpresa(id: string): Promise<Empresa | null> {
  const { data, error } = await supabase.from("empresas").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Empresa) ?? null;
}

export async function createEmpresa(payload: EmpresaInsert): Promise<Empresa> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("empresas")
    .insert({ ...payload, created_by: userData.user?.id ?? null })
    .select("*")
    .single();
  if (error) throw error;
  return data as Empresa;
}

export async function updateEmpresa(id: string, payload: EmpresaUpdate): Promise<Empresa> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("empresas")
    .update({ ...payload, updated_by: userData.user?.id ?? null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Empresa;
}

export async function deleteEmpresa(id: string): Promise<void> {
  const { error } = await supabase.from("empresas").delete().eq("id", id);
  if (error) throw error;
}

export interface TomadorVinculado {
  id: string;
  razao_social: string;
  cnpj: string;
  is_active: boolean;
}

export async function listTomadoresDaEmpresa(empresaId: string): Promise<TomadorVinculado[]> {
  const { data, error } = await supabase
    .from("tomadores")
    .select("id, razao_social, cnpj, is_active")
    .eq("empresa_id", empresaId)
    .order("razao_social");
  if (error) throw error;
  return (data ?? []) as TomadorVinculado[];
}
