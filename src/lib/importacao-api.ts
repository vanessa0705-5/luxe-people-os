import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { onlyDigits } from "@/lib/br-format";
import type { ModuloImportacao, RegistroImportado } from "@/lib/importacao-config";

export const EXTENSOES_ACEITAS = ".xlsx,.xls,.csv,.pdf";
const LIMITE_LINHAS = 300;

export function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

/** Lê uma planilha (Excel/CSV) no navegador e devolve as linhas como objetos. */
export async function lerPlanilha(file: File): Promise<Record<string, unknown>[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("A planilha não possui abas com dados.");
  const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false,
  });
  if (linhas.length === 0) throw new Error("A planilha está vazia.");
  return linhas.slice(0, LIMITE_LINHAS);
}

export async function arquivoParaBase64(file: File): Promise<string> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < buffer.length; i += chunk) {
    binary += String.fromCharCode(...buffer.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function txt(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function data(v: unknown): string | null {
  const s = txt(v);
  if (!s) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return null;
}

function opcao<T extends string>(v: unknown, permitidos: readonly T[]): T | null {
  const s = txt(v)?.toLowerCase();
  return s && (permitidos as readonly string[]).includes(s) ? (s as T) : null;
}

export interface ResultadoImportacao {
  inseridos: number;
  erros: { linha: number; mensagem: string }[];
}

/** Grava os registros revisados no banco, conforme o módulo. */
export async function gravarRegistros(
  modulo: ModuloImportacao,
  registros: RegistroImportado[],
  opcoes?: { tomadorId?: string | null; empresaId?: string | null },
): Promise<ResultadoImportacao> {
  const erros: ResultadoImportacao["erros"] = [];
  let inseridos = 0;

  const colaboradores =
    modulo === "ferias"
      ? ((
          await supabase.from("colaboradores").select("id, nome_completo, cpf, matricula")
        ).data ?? [])
      : [];

  for (let i = 0; i < registros.length; i++) {
    const r = registros[i];
    try {
      if (modulo === "colaboradores") {
        const nome = txt(r.nome_completo);
        const cpf = onlyDigits(String(r.cpf ?? ""));
        if (!nome) throw new Error("Nome completo é obrigatório.");
        if (cpf.length !== 11) throw new Error("CPF inválido (11 dígitos).");
        const { error } = await supabase.from("colaboradores").insert({
          nome_completo: nome,
          cpf,
          matricula: txt(r.matricula),
          cargo: txt(r.cargo),
          funcao: txt(r.funcao),
          departamento: txt(r.departamento),
          data_admissao: data(r.data_admissao),
          data_nascimento: data(r.data_nascimento),
          tipo_contrato: opcao(r.tipo_contrato, [
            "clt",
            "pj",
            "temporario",
            "estagio",
            "terceirizado",
          ] as const),
          salario: num(r.salario),
          jornada_semanal: num(r.jornada_semanal),
          email: txt(r.email),
          telefone: onlyDigits(String(r.telefone ?? "")) || null,
          cidade: txt(r.cidade),
          uf: txt(r.uf)?.toUpperCase().slice(0, 2) ?? null,
          status: opcao(r.status, ["ativo", "afastado", "ferias", "desligado"] as const) ?? "ativo",
          tomador_id: opcoes?.tomadorId ?? null,
        });
        if (error) throw error;
      } else if (modulo === "empresas") {
        const razao = txt(r.razao_social);
        const cnpj = onlyDigits(String(r.cnpj ?? ""));
        if (!razao) throw new Error("Razão social é obrigatória.");
        if (cnpj.length !== 14) throw new Error("CNPJ inválido (14 dígitos).");
        const { error } = await supabase.from("empresas").insert({
          razao_social: razao,
          nome_fantasia: txt(r.nome_fantasia),
          cnpj,
          inscricao_estadual: txt(r.inscricao_estadual),
          inscricao_municipal: txt(r.inscricao_municipal),
          cnae: txt(r.cnae),
          status: opcao(r.status, ["ativa", "inativa"] as const) ?? "ativa",
          cep: onlyDigits(String(r.cep ?? "")) || null,
          logradouro: txt(r.logradouro),
          numero: txt(r.numero),
          complemento: txt(r.complemento),
          bairro: txt(r.bairro),
          cidade: txt(r.cidade),
          uf: txt(r.uf)?.toUpperCase().slice(0, 2) ?? null,
          responsavel_nome: txt(r.responsavel_nome),
          email: txt(r.email),
          telefone: onlyDigits(String(r.telefone ?? "")) || null,
        });
        if (error) throw error;
      } else if (modulo === "tomadores") {
        const razao = txt(r.razao_social);
        if (!razao) throw new Error("Razão social é obrigatória.");
        const { error } = await supabase.from("tomadores").insert({
          razao_social: razao,
          nome_fantasia: txt(r.nome_fantasia),
          cnpj: onlyDigits(String(r.cnpj ?? "")) || "",
          email: txt(r.email),
          telefone: onlyDigits(String(r.telefone ?? "")) || null,
          cep: onlyDigits(String(r.cep ?? "")) || null,
          logradouro: txt(r.logradouro),
          numero: txt(r.numero),
          complemento: txt(r.complemento),
          bairro: txt(r.bairro),
          cidade: txt(r.cidade),
          uf: txt(r.uf)?.toUpperCase().slice(0, 2) ?? null,
          empresa_id: opcoes?.empresaId ?? null,
        });
        if (error) throw error;
      } else {
        const inicio = data(r.data_inicio);
        const fim = data(r.data_fim);
        if (!inicio || !fim) throw new Error("Datas de início e término são obrigatórias.");
        const cpf = onlyDigits(String(r.colaborador_cpf ?? ""));
        const matricula = txt(r.colaborador_matricula)?.toLowerCase();
        const nome = txt(r.colaborador_nome)?.toLowerCase();
        const colaborador = colaboradores.find(
          (c) =>
            (cpf && onlyDigits(c.cpf) === cpf) ||
            (matricula && (c.matricula ?? "").toLowerCase() === matricula) ||
            (nome && c.nome_completo.toLowerCase() === nome),
        );
        if (!colaborador) throw new Error("Colaborador não encontrado no cadastro.");
        const dias =
          Math.round(
            (new Date(`${fim}T00:00:00`).getTime() - new Date(`${inicio}T00:00:00`).getTime()) /
              86400000,
          ) + 1;
        if (dias <= 0) throw new Error("O término não pode ser anterior ao início.");
        const { error } = await supabase.from("ferias").insert({
          colaborador_id: colaborador.id,
          periodo_aquisitivo_inicio: data(r.periodo_aquisitivo_inicio),
          periodo_aquisitivo_fim: data(r.periodo_aquisitivo_fim),
          data_inicio: inicio,
          data_fim: fim,
          dias,
          observacoes: txt(r.observacoes),
        });
        if (error) throw error;
      }
      inseridos++;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Erro ao gravar o registro.";
      erros.push({ linha: i + 1, mensagem });
    }
  }

  return { inseridos, erros };
}
