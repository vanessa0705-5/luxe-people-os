import { z } from "zod";

/** Módulos que aceitam importação por planilha ou PDF. */
export type ModuloImportacao =
  | "colaboradores"
  | "empresas"
  | "tomadores"
  | "ferias"
  | "asos"
  | "nrs";

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

export const SCHEMA_ASO = z.object({
  colaborador_nome: texto,
  colaborador_cpf: texto,
  colaborador_matricula: texto,
  tipo_exame: texto,
  data_exame: texto,
  data_vencimento: texto,
  validade_meses: numero,
  resultado: texto,
  clinica: texto,
  medico_responsavel: texto,
  crm: texto,
  cargo: texto,
  unidade: texto,
  observacoes: texto,
});

export const SCHEMA_NR = z.object({
  colaborador_nome: texto,
  colaborador_cpf: texto,
  colaborador_matricula: texto,
  nr_codigo: texto,
  nome_treinamento: texto,
  data_realizacao: texto,
  data_validade: texto,
  validade_meses: numero,
  carga_horaria: numero,
  instrutor: texto,
  cargo: texto,
  unidade: texto,
  observacoes: texto,
});

export const SCHEMAS = {
  colaboradores: SCHEMA_COLABORADOR,
  empresas: SCHEMA_EMPRESA,
  tomadores: SCHEMA_TOMADOR,
  ferias: SCHEMA_FERIAS,
  asos: SCHEMA_ASO,
  nrs: SCHEMA_NR,
} as const;

export type RegistroColaborador = z.infer<typeof SCHEMA_COLABORADOR>;
export type RegistroEmpresa = z.infer<typeof SCHEMA_EMPRESA>;
export type RegistroTomador = z.infer<typeof SCHEMA_TOMADOR>;
export type RegistroFerias = z.infer<typeof SCHEMA_FERIAS>;
export type RegistroAso = z.infer<typeof SCHEMA_ASO>;
export type RegistroNr = z.infer<typeof SCHEMA_NR>;
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
  asos: {
    label: "ASO",
    descricao:
      "Leia o Atestado de Saúde Ocupacional em PDF (ou uma planilha) para preencher os dados e o vencimento automaticamente.",
    colunas: [
      { campo: "colaborador_nome", label: "Colaborador" },
      { campo: "colaborador_cpf", label: "CPF" },
      { campo: "tipo_exame", label: "Tipo de exame" },
      { campo: "data_exame", label: "Data do exame" },
      { campo: "data_vencimento", label: "Vencimento" },
      { campo: "resultado", label: "Resultado" },
      { campo: "clinica", label: "Clínica" },
      { campo: "medico_responsavel", label: "Médico" },
    ],
    obrigatorios: ["data_exame"],
    instrucoes:
      "Tipo de exame deve usar exatamente: admissional, periodico, retorno_trabalho, mudanca_risco, demissional. Resultado deve usar: apto, inapto, apto_com_restricao. Extraia data_vencimento (validade do exame) sempre que o documento indicar vencimento, validade, próximo exame ou data do próximo periódico; se o documento informar apenas o prazo em meses, preencha validade_meses.",
  },
  nrs: {
    label: "Treinamentos de NR",
    descricao:
      "Leia certificados de treinamento de NR em PDF (ou uma planilha) para preencher os dados e a validade automaticamente.",
    colunas: [
      { campo: "colaborador_nome", label: "Colaborador" },
      { campo: "colaborador_cpf", label: "CPF" },
      { campo: "nr_codigo", label: "NR" },
      { campo: "nome_treinamento", label: "Treinamento" },
      { campo: "data_realizacao", label: "Realização" },
      { campo: "data_validade", label: "Validade" },
      { campo: "carga_horaria", label: "Carga horária" },
      { campo: "instrutor", label: "Instrutor" },
    ],
    obrigatorios: ["data_realizacao"],
    instrucoes:
      "nr_codigo deve ser o código da norma no formato NR-XX (ex.: NR-35). Extraia data_validade sempre que o certificado indicar validade, vencimento ou reciclagem; se informar apenas o prazo em meses ou anos, preencha validade_meses (anos x 12).",
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
