import { supabase } from "@/integrations/supabase/client";

export interface FolhaLinha {
  matricula: string;
  nome: string;
  cnpj: string;
  valorFolha: number;
  fgts: number;
  consignado: number;
  inss: number;
  irrf: number;
}

export interface RateioLinha {
  matricula: string;
  tomador: string;
  percentual: number;
}

export interface InconsistenciaRateio {
  tipo: "matricula" | "tomador" | "percentual" | "cnpj" | "valor" | "total";
  matricula?: string;
  mensagem: string;
}

export interface RateioTomador {
  tomador: string;
  colaboradores: number;
  folha: number;
  fgtsConsignado: number;
  inss: number;
  irrf: number;
  totalGeral: number;
}

export interface RateioCnpj {
  cnpj: string;
  colaboradores: number;
  tomadores: number;
  folha: number;
  fgtsConsignado: number;
  inss: number;
  irrf: number;
  totalGeral: number;
  detalhes: RateioTomador[];
}

export interface ResultadoRateio {
  cnpjs: RateioCnpj[];
  resumo: {
    empresas: number;
    tomadores: number;
    colaboradores: number;
    folha: number;
    fgtsConsignado: number;
    inss: number;
    irrf: number;
    totalGeral: number;
  };
}

export interface RateioFolhaRegistro {
  id: string;
  competencia: string;
  arquivo_folha_nome: string | null;
  arquivo_rateio_nome: string | null;
  quantidade_empresas: number;
  quantidade_tomadores: number;
  quantidade_colaboradores: number;
  total_folha: number;
  total_fgts_consignado: number;
  total_inss: number;
  total_irrf: number;
  total_geral: number;
  resultado: ResultadoRateio;
  folha_origem: FolhaLinha[];
  rateio_origem: RateioLinha[];
  created_at: string;
  created_by: string | null;
}

const db = supabase as any;
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const onlyDigits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function numero(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let text = String(value ?? "")
    .replace(/R\$/gi, "")
    .replace(/%/g, "")
    .replace(/\s/g, "");
  if (text.includes(",") && text.includes(".")) {
    text =
      text.lastIndexOf(",") > text.lastIndexOf(".")
        ? text.replace(/\./g, "").replace(",", ".")
        : text.replace(/,/g, "");
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function campo(row: Record<string, unknown>, aliases: string[]): unknown {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const found = entries.find(([key]) => normalize(key) === normalize(alias));
    if (found) return found[1];
  }
  return "";
}

function matricula(value: unknown): string {
  return String(value ?? "").trim().replace(/\.0+$/, "");
}

async function carregarXlsx() {
  const module = (await import("xlsx")) as any;
  return (module.default ?? module) as typeof import("xlsx");
}

/** Lê o arquivo e devolve as matrizes de valores de cada planilha. */
export async function matrizesDoArquivo(file: File): Promise<unknown[][][]> {
  const buffer = await file.arrayBuffer();
  const XLSX = await carregarXlsx();
  let matrizes: unknown[][][] = [];
  try {
    const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
    matrizes = workbook.SheetNames.map((nome) =>
      XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[nome], {
        header: 1,
        defval: "",
        raw: false,
      }),
    );
  } catch {
    matrizes = [];
  }

  const possuiConteudo = matrizes.some((matriz) =>
    matriz.some((linha) => (linha ?? []).some((cell) => String(cell ?? "").trim())),
  );
  if (possuiConteudo) return matrizes;

  const { lerMatrizesLegado } = await import("@/lib/xls-legado");
  return lerMatrizesLegado(buffer);
}

function extrairLinhas(
  matrizes: unknown[][][],
  obrigatorias: string[][],
  descricao: string,
): Record<string, unknown>[] {
  const linhas: Record<string, unknown>[] = [];
  const cabecalhosEncontrados = new Set<string>();

  for (const matriz of matrizes) {
    const limite = Math.min(matriz.length, 30);
    let indiceCabecalho = -1;

    for (let index = 0; index < limite; index += 1) {
      const normalizados = (matriz[index] ?? []).map(normalize);
      const valido = obrigatorias.every((aliases) =>
        aliases.some((alias) => normalizados.includes(normalize(alias))),
      );
      if (valido) {
        indiceCabecalho = index;
        break;
      }
    }

    if (indiceCabecalho < 0) {
      for (const cell of (matriz[0] ?? []).slice(0, 20)) {
        if (String(cell).trim()) cabecalhosEncontrados.add(String(cell).trim());
      }
      continue;
    }

    const headers = (matriz[indiceCabecalho] ?? []).map((value) => String(value ?? "").trim());
    for (const valores of matriz.slice(indiceCabecalho + 1)) {
      const row: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        if (header) row[header] = valores?.[index] ?? "";
      });
      if (Object.values(row).some((value) => String(value ?? "").trim())) linhas.push(row);
    }
  }

  if (!linhas.length) {
    const esperadas = obrigatorias.map((aliases) => aliases[0]).join(", ");
    const encontradas = Array.from(cabecalhosEncontrados).join(", ");
    throw new Error(
      "Não foi possível ler o arquivo de " +
        descricao +
        ". Verifique se a planilha contém as colunas: " +
        esperadas +
        (encontradas ? ". Colunas encontradas: " + encontradas : "."),
    );
  }

  return linhas;
}


export async function importarFolha(file: File): Promise<FolhaLinha[]> {
  const matrizes = await matrizesDoArquivo(file);
  const aliases = {
    matricula: ["Matrícula", "Matricula", "Registro", "Chapa", "Código", "Codigo"],
    nome: ["Nome", "Colaborador", "Nome do colaborador", "Funcionário", "Funcionario"],
    cnpj: ["Empresa (CNPJ)", "CNPJ", "CNPJ Empresa", "Empresa"],
    folha: ["Valor Folha", "Folha", "Valor", "Valor da Folha", "Líquido", "Liquido"],
    fgts: ["FGTS", "Valor FGTS"],
    consignado: ["Consignado", "Empréstimo Consignado", "Emprestimo Consignado"],
    inss: ["INSS", "Valor INSS"],
    irrf: ["IRRF", "Valor IRRF"],
  };
  const rows = extrairLinhas(matrizes, [aliases.matricula, aliases.cnpj, aliases.folha], "folha");

  const result = rows
    .map((row) => ({
      matricula: matricula(campo(row, aliases.matricula)),
      nome: String(campo(row, aliases.nome)).trim(),
      cnpj: onlyDigits(campo(row, aliases.cnpj)),
      valorFolha: numero(campo(row, aliases.folha)),
      fgts: numero(campo(row, aliases.fgts)),
      consignado: numero(campo(row, aliases.consignado)),
      inss: numero(campo(row, aliases.inss)),
      irrf: numero(campo(row, aliases.irrf)),
    }))
    .filter((row) => row.matricula || row.nome || row.cnpj);

  if (!result.length) throw new Error("A planilha da folha não possui registros válidos.");
  return result;
}

export async function importarRateio(file: File): Promise<RateioLinha[]> {
  const matrizes = await matrizesDoArquivo(file);
  const aliases = {
    matricula: ["Matrícula", "Matricula", "Registro", "Chapa", "Código", "Codigo"],
    tomador: ["Tomador", "Cliente", "Centro de custo", "Centro de Custo"],
    percentual: ["Percentual", "%", "Percentual Rateio", "Percentual de Rateio"],
  };
  const rows = extrairLinhas(
    matrizes,
    [aliases.matricula, aliases.tomador, aliases.percentual],
    "rateio",
  );

  const result = rows
    .map((row) => ({
      matricula: matricula(campo(row, aliases.matricula)),
      tomador: String(campo(row, aliases.tomador)).trim(),
      percentual: numero(campo(row, aliases.percentual)),
    }))
    .filter((row) => row.matricula || row.tomador || row.percentual);

  if (!result.length) throw new Error("A planilha de rateio não possui registros válidos.");
  return result;
}

export function processarRateio(
  folha: FolhaLinha[],
  rateios: RateioLinha[],
  modo: ModoRateio = "completo",
): { resultado: ResultadoRateio | null; inconsistencias: InconsistenciaRateio[] } {

  const inconsistencias: InconsistenciaRateio[] = [];
  const folhaPorMatricula = new Map<string, FolhaLinha>();
  const duplicadas = new Set<string>();

  for (const linha of folha) {
    if (!linha.matricula) {
      inconsistencias.push({ tipo: "matricula", mensagem: "Há uma linha da folha sem matrícula." });
      continue;
    }
    if (folhaPorMatricula.has(linha.matricula)) duplicadas.add(linha.matricula);
    folhaPorMatricula.set(linha.matricula, linha);
    if (linha.cnpj.length !== 14) {
      inconsistencias.push({
        tipo: "cnpj",
        matricula: linha.matricula,
        mensagem: "CNPJ inválido para a matrícula " + linha.matricula + ".",
      });
    }
    if ([linha.valorFolha, linha.fgts, linha.consignado, linha.inss, linha.irrf].some((v) => v < 0)) {
      inconsistencias.push({
        tipo: "valor",
        matricula: linha.matricula,
        mensagem: "Existem valores negativos para a matrícula " + linha.matricula + ".",
      });
    }
  }

  for (const matricula of duplicadas) {
    inconsistencias.push({
      tipo: "matricula",
      matricula,
      mensagem: "Matrícula duplicada na folha: " + matricula + ".",
    });
  }

  const rateiosPorMatricula = new Map<string, RateioLinha[]>();
  const combinacoes = new Set<string>();
  for (const linha of rateios) {
    const chave = linha.matricula + "|" + normalize(linha.tomador);
    if (combinacoes.has(chave)) {
      inconsistencias.push({
        tipo: "matricula",
        matricula: linha.matricula,
        mensagem: "Tomador duplicado no rateio da matrícula " + linha.matricula + ".",
      });
    }
    combinacoes.add(chave);
    if (!folhaPorMatricula.has(linha.matricula)) {
      inconsistencias.push({
        tipo: "matricula",
        matricula: linha.matricula,
        mensagem: "A matrícula " + linha.matricula + " existe no rateio, mas não existe na folha.",
      });
    }
    const lista = rateiosPorMatricula.get(linha.matricula) ?? [];
    lista.push(linha);
    rateiosPorMatricula.set(linha.matricula, lista);
  }

  for (const linha of folha) {
    const distribuicoes = rateiosPorMatricula.get(linha.matricula) ?? [];
    if (!distribuicoes.length || distribuicoes.some((r) => !r.tomador.trim())) {
      inconsistencias.push({
        tipo: "tomador",
        matricula: linha.matricula,
        mensagem: "Colaborador sem tomador: " + linha.matricula + " — " + linha.nome + ".",
      });
      continue;
    }
    const totalPercentual = round2(distribuicoes.reduce((acc, item) => acc + item.percentual, 0));
    if (Math.abs(totalPercentual - 100) > 0.01) {
      inconsistencias.push({
        tipo: "percentual",
        matricula: linha.matricula,
        mensagem:
          "O percentual da matrícula " +
          linha.matricula +
          " soma " +
          totalPercentual.toLocaleString("pt-BR") +
          "%; deve somar exatamente 100%.",
      });
    }
  }

  if (inconsistencias.length) return { resultado: null, inconsistencias };

  type Acumulador = RateioTomador & { matriculas: Set<string> };
  const grupos = new Map<string, Map<string, Acumulador>>();

  for (const linha of folha) {
    const distribuicoes = rateiosPorMatricula.get(linha.matricula)!;
    const usados = { folha: 0, fgts: 0, consignado: 0, inss: 0, irrf: 0 };
    distribuicoes.forEach((distribuicao, index) => {
      const ultima = index === distribuicoes.length - 1;
      const parte = (valor: number, chave: keyof typeof usados) => {
        const calculado = ultima ? round2(valor - usados[chave]) : round2(valor * distribuicao.percentual / 100);
        usados[chave] = round2(usados[chave] + calculado);
        return calculado;
      };
      const folhaRateada = parte(linha.valorFolha, "folha");
      const fgtsRateado = parte(linha.fgts, "fgts");
      const consignadoRateado = parte(linha.consignado, "consignado");
      const inssRateado = parte(linha.inss, "inss");
      const irrfRateado = parte(linha.irrf, "irrf");
      const porTomador = grupos.get(linha.cnpj) ?? new Map<string, Acumulador>();
      const atual = porTomador.get(distribuicao.tomador) ?? {
        tomador: distribuicao.tomador,
        colaboradores: 0,
        folha: 0,
        fgtsConsignado: 0,
        inss: 0,
        irrf: 0,
        totalGeral: 0,
        matriculas: new Set<string>(),
      };
      atual.matriculas.add(linha.matricula);
      atual.folha = round2(atual.folha + folhaRateada);
      atual.fgtsConsignado = round2(atual.fgtsConsignado + fgtsRateado + consignadoRateado);
      atual.inss = round2(atual.inss + inssRateado);
      atual.irrf = round2(atual.irrf + irrfRateado);
      atual.totalGeral = round2(atual.folha + atual.fgtsConsignado + atual.inss + atual.irrf);
      porTomador.set(distribuicao.tomador, atual);
      grupos.set(linha.cnpj, porTomador);
    });
  }

  const cnpjs: RateioCnpj[] = Array.from(grupos.entries())
    .map(([cnpj, mapa]) => {
      const detalhes = Array.from(mapa.values())
        .map(({ matriculas, ...item }) => ({ ...item, colaboradores: matriculas.size }))
        .sort((a, b) => a.tomador.localeCompare(b.tomador, "pt-BR"));
      const soma = (chave: keyof Pick<RateioTomador, "folha" | "fgtsConsignado" | "inss" | "irrf" | "totalGeral">) =>
        round2(detalhes.reduce((acc, item) => acc + item[chave], 0));
      return {
        cnpj,
        colaboradores: new Set(
          folha.filter((item) => item.cnpj === cnpj).map((item) => item.matricula),
        ).size,
        tomadores: detalhes.length,
        folha: soma("folha"),
        fgtsConsignado: soma("fgtsConsignado"),
        inss: soma("inss"),
        irrf: soma("irrf"),
        totalGeral: soma("totalGeral"),
        detalhes,
      };
    })
    .sort((a, b) => a.cnpj.localeCompare(b.cnpj));

  const resumo = {
    empresas: cnpjs.length,
    tomadores: new Set(cnpjs.flatMap((item) => item.detalhes.map((d) => d.tomador))).size,
    colaboradores: folhaPorMatricula.size,
    folha: round2(cnpjs.reduce((acc, item) => acc + item.folha, 0)),
    fgtsConsignado: round2(cnpjs.reduce((acc, item) => acc + item.fgtsConsignado, 0)),
    inss: round2(cnpjs.reduce((acc, item) => acc + item.inss, 0)),
    irrf: round2(cnpjs.reduce((acc, item) => acc + item.irrf, 0)),
    totalGeral: round2(cnpjs.reduce((acc, item) => acc + item.totalGeral, 0)),
  };

  const totalFolhaOrigem = round2(folha.reduce((acc, item) => acc + item.valorFolha, 0));
  if (Math.abs(totalFolhaOrigem - resumo.folha) > 0.02) {
    inconsistencias.push({
      tipo: "total",
      mensagem:
        "O total da folha importada (" +
        formatarMoeda(totalFolhaOrigem) +
        ") não corresponde ao total rateado (" +
        formatarMoeda(resumo.folha) +
        ").",
    });
    return { resultado: null, inconsistencias };
  }

  return { resultado: { cnpjs, resumo }, inconsistencias: [] };
}

export async function salvarRateio(input: {
  competencia: string;
  arquivoFolhaNome: string;
  arquivoRateioNome: string;
  folha: FolhaLinha[];
  rateios: RateioLinha[];
  resultado: ResultadoRateio;
}): Promise<RateioFolhaRegistro> {
  const { data: userData } = await supabase.auth.getUser();
  const payload = {
    competencia: input.competencia + "-01",
    arquivo_folha_nome: input.arquivoFolhaNome,
    arquivo_rateio_nome: input.arquivoRateioNome,
    quantidade_empresas: input.resultado.resumo.empresas,
    quantidade_tomadores: input.resultado.resumo.tomadores,
    quantidade_colaboradores: input.resultado.resumo.colaboradores,
    total_folha: input.resultado.resumo.folha,
    total_fgts_consignado: input.resultado.resumo.fgtsConsignado,
    total_inss: input.resultado.resumo.inss,
    total_irrf: input.resultado.resumo.irrf,
    total_geral: input.resultado.resumo.totalGeral,
    resultado: input.resultado,
    folha_origem: input.folha,
    rateio_origem: input.rateios,
    created_by: userData.user?.id ?? null,
  };
  const { data, error } = await db.from("rateios_folha").insert(payload).select("*").single();
  if (error) throw error;
  return data as RateioFolhaRegistro;
}

export async function listarRateios(): Promise<RateioFolhaRegistro[]> {
  const { data, error } = await db
    .from("rateios_folha")
    .select("*")
    .order("competencia", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as RateioFolhaRegistro[];
}

export async function excluirRateio(id: string): Promise<void> {
  const { error } = await db.from("rateios_folha").delete().eq("id", id);
  if (error) throw error;
}

export function formatarMoeda(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

export function formatarCompetencia(value: string): string {
  const [ano, mes] = value.slice(0, 7).split("-");
  return mes + "/" + ano;
}

export async function exportarExcel(registro: RateioFolhaRegistro): Promise<void> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([
      {
        Competência: formatarCompetencia(registro.competencia),
        Empresas: registro.quantidade_empresas,
        Tomadores: registro.quantidade_tomadores,
        Colaboradores: registro.quantidade_colaboradores,
        "Total Folha": registro.total_folha,
        "FGTS + Consignado": registro.total_fgts_consignado,
        INSS: registro.total_inss,
        IRRF: registro.total_irrf,
        "Total Geral": registro.total_geral,
      },
    ]),
    "Resumo Geral",
  );

  const secoes = [
    ["Folha", "folha"],
    ["FGTS Consig", "fgtsConsignado"],
    ["INSS", "inss"],
    ["IRRF", "irrf"],
  ] as const;
  for (const cnpj of registro.resultado.cnpjs) {
    for (const [nome, chave] of secoes) {
      const dados = cnpj.detalhes.map((item) => ({
        CNPJ: cnpj.cnpj,
        Tomador: item.tomador,
        "Quantidade de Colaboradores": item.colaboradores,
        Valor: item[chave],
      }));
      const sufixo = cnpj.cnpj.slice(-4);
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(dados),
        (nome + " " + sufixo).slice(0, 31),
      );
    }
  }
  XLSX.writeFile(workbook, "rateio-folha-" + registro.competencia.slice(0, 7) + ".xlsx");
}

export function exportarPdf(registro: RateioFolhaRegistro): void {
  const janela = window.open("", "_blank", "noopener,noreferrer");
  if (!janela) throw new Error("Permita pop-ups para gerar o PDF.");
  const secoes = registro.resultado.cnpjs
    .map(
      (cnpj) =>
        "<section><h2>CNPJ " +
        cnpj.cnpj +
        "</h2>" +
        ["folha", "fgtsConsignado", "inss", "irrf"]
          .map((chave) => {
            const nomes: Record<string, string> = {
              folha: "Folha",
              fgtsConsignado: "FGTS + Consignado",
              inss: "INSS",
              irrf: "IRRF",
            };
            return (
              "<h3>" +
              nomes[chave] +
              "</h3><table><thead><tr><th>Tomador</th><th>Colaboradores</th><th>Valor</th></tr></thead><tbody>" +
              cnpj.detalhes
                .map(
                  (item) =>
                    "<tr><td>" +
                    item.tomador +
                    "</td><td>" +
                    item.colaboradores +
                    "</td><td>" +
                    formatarMoeda(item[chave as keyof RateioTomador] as number) +
                    "</td></tr>",
                )
                .join("") +
              "</tbody></table>"
            );
          })
          .join("") +
        "<p class='total'>Total geral do CNPJ: " +
        formatarMoeda(cnpj.totalGeral) +
        "</p></section>",
    )
    .join("");

  janela.document.write(
    "<!doctype html><html><head><title>Rateio de Folha</title><style>" +
      "body{font-family:Arial,sans-serif;color:#1f2937;padding:24px}h1{margin-bottom:4px}h2{margin-top:28px;border-bottom:2px solid #b8923b;padding-bottom:6px}h3{margin:18px 0 6px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #d1d5db;padding:7px;text-align:left}th{background:#f3f4f6}.total{font-weight:bold;text-align:right}.no-print{margin-bottom:20px}@media print{.no-print{display:none}section{break-inside:avoid}}</style></head><body>" +
      "<button class='no-print' onclick='window.print()'>Salvar como PDF</button><h1>Rateio de Folha</h1><p>Competência " +
      formatarCompetencia(registro.competencia) +
      "</p>" +
      secoes +
      "</body></html>",
  );
  janela.document.close();
  janela.focus();
  setTimeout(() => janela.print(), 400);
}
