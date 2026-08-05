import { z } from "zod";

/** Módulos que aceitam importação por planilha ou PDF. */
export type ModuloImportacao = "colaboradores" | "empresas" | "tomadores" | "ferias";

const texto = z.string().nullable();
const numero = z.number().nullable();

export const SCHEMA_COLABORADOR = z.object({
  nome_completo: texto,
  cpf: texto,
  matricula: texto,
  cargo: texto,
  funcao: texto,
  departamento: texto,
  data_admissao: texto,
  data_nascimento: texto,
  tipo_contrato: texto,
  salario: numero,
  jornada_semanal: numero,
  email: texto,
  telefone: texto,
  cidade: texto,
  uf: texto,
  status: texto,
});

export const SCHEMA_EMPRESA = z.object({
  razao_social: texto,
  nome_fantasia: texto,
  cnpj: texto,
  inscricao_estadual: texto,
  inscricao_municipal: texto,
  cnae: texto,
  status: texto,
  cep: texto,
  logradouro: texto,
  numero: texto,
  complemento: texto,
  bairro: texto,
  cidade: texto,
  uf: texto,
  responsavel_nome: texto,
  email: texto,
  telefone: texto,
});

export const SCHEMA_TOMADOR = z.object({
  razao_social: texto,
  nome_fantasia: texto,
  cnpj: texto,
  email: texto,
  telefone: texto,
  cep: texto,
  logradouro: texto,
  numero: texto,
  complemento: texto,
  bairro: texto,
  cidade: texto,
  uf: texto,
});

export const SCHEMA_FERIAS = z.object({
  colaborador_nome: texto,
  colaborador_cpf: texto,
  colaborador_matricula: texto,
  periodo_aquisitivo_inicio: texto,
  periodo_aquisitivo_fim: texto,
  data_inicio: texto,
  data_fim: texto,
  observacoes: texto,
});

export const SCHEMAS = {
  colaboradores: SCHEMA_COLABORADOR,
  empresas: SCHEMA_EMPRESA,
  tomadores: SCHEMA_TOMADOR,
  ferias: SCHEMA_FERIAS,
} as const;

export type RegistroColaborador = z.infer<typeof SCHEMA_COLABORADOR>;
export type RegistroEmpresa = z.infer<typeof SCHEMA_EMPRESA>;
export type RegistroTomador = z.infer<typeof SCHEMA_TOMADOR>;
export type RegistroFerias = z.infer<typeof SCHEMA_FERIAS>;
export type RegistroImportado = Record<string, string | number | null>;

interface ModuloConfig {
  label: string;
  descricao: string;
  /** Colunas exibidas na pré-visualização, na ordem. */
  colunas: { campo: string; label: string }[];
  obrigatorios: string[];
  instrucoes: string;
}

export const MODULOS_IMPORTACAO: Record<ModuloImportacao, ModuloConfig> = {
  colaboradores: {
    label: "Colaboradores",
    descricao: "Importe colaboradores a partir de uma planilha Excel/CSV ou de um PDF.",
    colunas: [
      { campo: "nome_completo", label: "Nome completo" },
      { campo: "cpf", label: "CPF" },
      { campo: "matricula", label: "Matrícula" },
      { campo: "cargo", label: "Cargo" },
      { campo: "departamento", label: "Departamento" },
      { campo: "data_admissao", label: "Admissão" },
      { campo: "salario", label: "Salário" },
      { campo: "email", label: "E-mail" },
      { campo: "telefone", label: "Telefone" },
    ],
    obrigatorios: ["nome_completo", "cpf"],
    instrucoes:
      "Campos de tipo de contrato devem usar exatamente um destes valores: clt, pj, temporario, estagio, terceirizado. Situação (status) deve usar: ativo, afastado, ferias, desligado.",
  },
  empresas: {
    label: "Empresas (CNPJs)",
    descricao: "Importe empresas a partir de uma planilha Excel/CSV ou de um PDF (ex.: cartão CNPJ).",
    colunas: [
      { campo: "razao_social", label: "Razão social" },
      { campo: "nome_fantasia", label: "Nome fantasia" },
      { campo: "cnpj", label: "CNPJ" },
      { campo: "cidade", label: "Cidade" },
      { campo: "uf", label: "UF" },
      { campo: "email", label: "E-mail" },
      { campo: "telefone", label: "Telefone" },
    ],
    obrigatorios: ["razao_social", "cnpj"],
    instrucoes: "Situação (status) deve usar exatamente: ativa ou inativa.",
  },
  tomadores: {
    label: "Tomadores",
    descricao: "Importe tomadores de serviço a partir de uma planilha Excel/CSV ou de um PDF.",
    colunas: [
      { campo: "razao_social", label: "Razão social" },
      { campo: "nome_fantasia", label: "Nome fantasia" },
      { campo: "cnpj", label: "CNPJ" },
      { campo: "cidade", label: "Cidade" },
      { campo: "uf", label: "UF" },
      { campo: "telefone", label: "Telefone" },
    ],
    obrigatorios: ["razao_social"],
    instrucoes: "",
  },
  ferias: {
    label: "Férias",
    descricao:
      "Importe períodos de férias. Os colaboradores são localizados por CPF, matrícula ou nome.",
    colunas: [
      { campo: "colaborador_nome", label: "Colaborador" },
      { campo: "colaborador_cpf", label: "CPF" },
      { campo: "colaborador_matricula", label: "Matrícula" },
      { campo: "periodo_aquisitivo_inicio", label: "Aquisitivo (início)" },
      { campo: "periodo_aquisitivo_fim", label: "Aquisitivo (fim)" },
      { campo: "data_inicio", label: "Início" },
      { campo: "data_fim", label: "Término" },
    ],
    obrigatorios: ["data_inicio", "data_fim"],
    instrucoes: "",
  },
};

export function montarPromptImportacao(modulo: ModuloImportacao, conteudo?: string): string {
  const cfg = MODULOS_IMPORTACAO[modulo];
  return [
    `Você é um assistente de RH brasileiro. Extraia os registros de ${cfg.label} do conteúdo fornecido.`,
    "Regras obrigatórias:",
    "- Retorne um item por registro/pessoa/empresa encontrado; ignore cabeçalhos, totais e linhas em branco.",
    "- Datas sempre no formato ISO yyyy-mm-dd (interprete datas brasileiras dd/mm/aaaa corretamente).",
    "- Valores monetários como número decimal, sem símbolo de moeda e sem separador de milhar.",
    "- CPF e CNPJ apenas com os dígitos.",
    "- Campos não encontrados devem ser null. Nunca invente dados.",
    cfg.instrucoes ? `- ${cfg.instrucoes}` : "",
    conteudo ? `\nConteúdo (linhas da planilha em JSON):\n${conteudo}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
