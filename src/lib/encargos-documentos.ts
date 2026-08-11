import type {
  InconsistenciaRateio,
  RateioFolhaRegistro,
  RateioTomador,
  ResultadoRateio,
} from "@/lib/rateio-folha-api";
import { matrizesDoArquivo } from "@/lib/rateio-folha-api";

export interface ArquivosEncargos {
  liquidos: File;
  fgtsMensal: File;
  consignado: File;
  guiaFgts: File;
  darf: File;
}

export interface ConferenciaEncargos {
  fgtsRelatorio: number;
  fgtsGuia: number;
  consignadoRelatorio: number;
  consignadoGuia: number;
  totalGuia: number;
  totalDarf: number;
  conferido: boolean;
}

export interface DetalheEncargos extends RateioTomador {
  fgts: number;
  consignado: number;
}

export interface ProcessamentoEncargos {
  resultado: ResultadoRateio | null;
  inconsistencias: InconsistenciaRateio[];
  detalhes: DetalheEncargos[];
  conferencia: ConferenciaEncargos;
  foraRateio: { prolabore: number; servicosPj: number; total: number };
}

type ColaboradorLiquidos = {
  cpf: string;
  nome: string;
  departamento: string;
  cnpj: string;
  liquido: number;
};

const round2 = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;
const digitos = (valor: unknown) => String(valor ?? "").replace(/\D/g, "");
const normalizar = (valor: unknown) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function numeroBr(valor: unknown): number {
  let texto = String(valor ?? "")
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .trim();
  if (!texto) return 0;
  if (texto.includes(",")) texto = texto.replace(/\./g, "").replace(",", ".");
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
}

function nomeSemCodigo(valor: string): string {
  return valor.replace(/^\s*\d+\s*-\s*/, "").trim();
}

async function lerColaboradoresLiquidos(file: File): Promise<ColaboradorLiquidos[]> {
  const matrizes = await matrizesDoArquivo(file);
  const colaboradores = new Map<string, ColaboradorLiquidos>();

  for (const matriz of matrizes) {
    let departamento = "";
    let cnpj = "";

    for (const linhaBruta of matriz) {
      const cells = (linhaBruta ?? []).map((cell) => String(cell ?? "").trim());
      const preenchidas = cells.filter(Boolean);
      const texto = preenchidas.join(" ");
      if (!texto) continue;

      if (/^Servi[çc]o:/i.test(texto)) {
        const achouCnpj = texto.match(/CNPJ:\s*([\d./-]+)/i);
        cnpj = achouCnpj ? digitos(achouCnpj[1]) : "";
        const semRotulo = texto.replace(/^Servi[çc]o:\s*/i, "");
        const semCnpj = semRotulo.replace(/\s*-\s*CNPJ:.*$/i, "");
        departamento = nomeSemCodigo(semCnpj);
        continue;
      }

      if (/^Departamento:/i.test(texto)) {
        const semRotulo = texto.replace(/^Departamento:\s*/i, "");
        const achouCnpj = semRotulo.match(/CNPJ:\s*([\d./-]+)/i);
        if (achouCnpj) cnpj = digitos(achouCnpj[1]);
        departamento = nomeSemCodigo(semRotulo.replace(/\s*-\s*CNPJ:.*$/i, ""));
        continue;
      }

      if (!departamento) continue;
      const indiceCpf = cells.findIndex((cell) => digitos(cell).length === 11);
      if (indiceCpf < 0) continue;

      const cpf = digitos(cells[indiceCpf]);
      const candidatosNome = cells
        .slice(0, indiceCpf)
        .filter((cell) => /[A-Za-zÀ-ÿ]/.test(cell) && !/^(c[oó]digo|nome|cpf)$/i.test(cell));
      const nome = candidatosNome[candidatosNome.length - 1] ?? "";
      const valores = cells
        .slice(indiceCpf + 1)
        .map(numeroBr)
        .filter((valor) => valor !== 0);
      const liquido = valores[valores.length - 1] ?? 0;
      if (!liquido) continue;

      const atual = colaboradores.get(cpf);
      if (!atual) {
        colaboradores.set(cpf, { cpf, nome, departamento, cnpj, liquido });
      }
    }
  }

  const lista = Array.from(colaboradores.values()).filter(
    (item) => item.cpf && item.departamento && item.liquido,
  );
  if (!lista.length) {
    throw new Error(
      "Relatório de Líquidos: não foi possível identificar CPF, Departamento/Tomador e valor líquido.",
    );
  }
  return lista;
}

async function extrairTextoPdf(file: File): Promise<string> {
  try {
    const moduloUrl =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
    const workerUrl =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
    const pdfjs = (await import(/* @vite-ignore */ moduloUrl)) as any;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const documento = await pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    }).promise;
    const paginas: string[] = [];
    for (let pagina = 1; pagina <= documento.numPages; pagina += 1) {
      const conteudo = await (await documento.getPage(pagina)).getTextContent();
      paginas.push(
        conteudo.items
          .map((item: { str?: string }) => item.str ?? "")
          .join(" "),
      );
    }
    const texto = paginas.join("\n").replace(/\s+/g, " ").trim();
    if (!texto) throw new Error("PDF sem texto pesquisável.");
    return texto;
  } catch (error) {
    throw new Error(
      file.name +
        ": não foi possível ler o PDF. " +
        (error instanceof Error ? error.message : "Arquivo inválido."),
    );
  }
}

function ocorrenciasPorCpf(texto: string): Array<{ cpf: string; trecho: string }> {
  const regex = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g;
  const encontrados = Array.from(texto.matchAll(regex));
  return encontrados.map((item, indice) => ({
    cpf: digitos(item[0]),
    trecho: texto.slice(
      (item.index ?? 0) + item[0].length,
      encontrados[indice + 1]?.index ?? texto.length,
    ),
  }));
}

function lerFgtsPorCpf(texto: string): Map<string, number> {
  const valores = new Map<string, number>();
  for (const item of ocorrenciasPorCpf(texto)) {
    const mensal = item.trecho.match(
      /Mensal\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})/i,
    );
    if (!mensal) continue;
    valores.set(item.cpf, round2((valores.get(item.cpf) ?? 0) + numeroBr(mensal[2])));
  }
  if (!valores.size)
    throw new Error(
      "Relatório do FGTS Mensal: não foram encontrados CPF e valor de FGTS por empregado.",
    );
  return valores;
}

function lerConsignadoPorCpf(texto: string): Map<string, number> {
  const valores = new Map<string, number>();
  for (const item of ocorrenciasPorCpf(texto)) {
    const moedas = Array.from(item.trecho.matchAll(/[\d.]+,\d{2}/g));
    if (!moedas.length) continue;
    const valor = numeroBr(moedas[0][0]);
    valores.set(item.cpf, round2((valores.get(item.cpf) ?? 0) + valor));
  }
  if (!valores.size)
    throw new Error(
      "Relatório do FGTS Consignado: não foram encontrados CPF e valor das parcelas.",
    );
  return valores;
}

function valorAposRotulo(texto: string, rotulo: RegExp): number {
  const encontrou = texto.match(rotulo);
  return encontrou ? numeroBr(encontrou[1]) : 0;
}

function lerGuiaFgts(texto: string) {
  const fgts = valorAposRotulo(texto, /Total\s+FGTS\s*[:\-]?\s*R?\$?\s*([\d.]+,\d{2})/i);
  const consignado = valorAposRotulo(
    texto,
    /Total\s+Consignado\s*[:\-]?\s*R?\$?\s*([\d.]+,\d{2})/i,
  );
  const total = valorAposRotulo(
    texto,
    /Total\s+da\s+Guia\s*[:\-]?\s*R?\$?\s*([\d.]+,\d{2})/i,
  );
  if (!fgts || !consignado || !total)
    throw new Error(
      "Guia FGTS + Consignado: os totais de FGTS, consignado e da guia não foram localizados.",
    );
  return { fgts, consignado, total };
}

function valorDoCodigoDarf(texto: string, codigo: string): number {
  const codigos = Array.from(texto.matchAll(/\b(?:1082|1099|0561|1708)(?:-\d+)?\b/g));
  const atual = codigos.findIndex((item) => item[0].startsWith(codigo));
  if (atual < 0) return 0;
  const inicio = (codigos[atual].index ?? 0) + codigos[atual][0].length;
  const fim = codigos[atual + 1]?.index ?? Math.min(texto.length, inicio + 1500);
  const moedas = Array.from(texto.slice(inicio, fim).matchAll(/[\d.]+,\d{2}/g));
  return moedas.length ? numeroBr(moedas[moedas.length - 1][0]) : 0;
}

function distribuir(total: number, bases: number[]): number[] {
  if (!bases.length) return [];
  const soma = bases.reduce((acc, valor) => acc + valor, 0);
  if (!soma) return bases.map(() => 0);
  let usado = 0;
  return bases.map((base, indice) => {
    if (indice === bases.length - 1) return round2(total - usado);
    const valor = round2((total * base) / soma);
    usado = round2(usado + valor);
    return valor;
  });
}

export async function processarEncargosDocumentos(
  arquivos: ArquivosEncargos,
): Promise<ProcessamentoEncargos> {
  const inconsistencias: InconsistenciaRateio[] = [];

  try {
    const [colaboradores, textoFgts, textoConsignado, textoGuia, textoDarf] =
      await Promise.all([
        lerColaboradoresLiquidos(arquivos.liquidos),
        extrairTextoPdf(arquivos.fgtsMensal),
        extrairTextoPdf(arquivos.consignado),
        extrairTextoPdf(arquivos.guiaFgts),
        extrairTextoPdf(arquivos.darf),
      ]);

    const fgtsPorCpf = lerFgtsPorCpf(textoFgts);
    const consignadoPorCpf = lerConsignadoPorCpf(textoConsignado);
    const guia = lerGuiaFgts(textoGuia);
    const darf = {
      inssEmpregados: valorDoCodigoDarf(textoDarf, "1082"),
      prolabore: valorDoCodigoDarf(textoDarf, "1099"),
      irrfEmpregados: valorDoCodigoDarf(textoDarf, "0561"),
      servicosPj: valorDoCodigoDarf(textoDarf, "1708"),
    };
    const totalDarf = round2(
      darf.inssEmpregados + darf.prolabore + darf.irrfEmpregados + darf.servicosPj,
    );
    if (!darf.inssEmpregados || !darf.irrfEmpregados)
      throw new Error("DARF: os códigos 1082 (INSS) e 0561 (IRRF) não foram localizados.");

    const porCpf = new Map(colaboradores.map((item) => [item.cpf, item]));
    for (const cpf of new Set([...fgtsPorCpf.keys(), ...consignadoPorCpf.keys()])) {
      if (!porCpf.has(cpf)) {
        inconsistencias.push({
          tipo: "tomador",
          matricula: cpf,
          mensagem:
            "CPF " +
            cpf +
            " consta nos encargos, mas não possui Departamento/Tomador no relatório de líquidos.",
        });
      }
    }

    const grupos = new Map<
      string,
      {
        nome: string;
        colaboradores: Set<string>;
        base: number;
        fgts: number;
        consignado: number;
      }
    >();

    for (const colaborador of colaboradores) {
      if (/\bpro\s*labore\b/.test(normalizar(colaborador.departamento))) continue;
      const chave = normalizar(colaborador.departamento);
      const grupo = grupos.get(chave) ?? {
        nome: nomeSemCodigo(colaborador.departamento),
        colaboradores: new Set<string>(),
        base: 0,
        fgts: 0,
        consignado: 0,
      };
      grupo.colaboradores.add(colaborador.cpf);
      grupo.base = round2(grupo.base + colaborador.liquido);
      grupo.fgts = round2(grupo.fgts + (fgtsPorCpf.get(colaborador.cpf) ?? 0));
      grupo.consignado = round2(
        grupo.consignado + (consignadoPorCpf.get(colaborador.cpf) ?? 0),
      );
      grupos.set(chave, grupo);
    }

    const lista = Array.from(grupos.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR"),
    );
    if (!lista.length)
      throw new Error("Relatório de Líquidos: nenhum departamento rateável foi encontrado.");

    const inssDistribuido = distribuir(
      darf.inssEmpregados,
      lista.map((item) => item.base),
    );
    const irrfDistribuido = distribuir(
      darf.irrfEmpregados,
      lista.map((item) => item.base),
    );

    const detalhes: DetalheEncargos[] = lista.map((item, indice) => {
      const fgtsConsignado = round2(item.fgts + item.consignado);
      const totalGeral = round2(
        fgtsConsignado + inssDistribuido[indice] + irrfDistribuido[indice],
      );
      return {
        tomador: item.nome,
        colaboradores: item.colaboradores.size,
        folha: 0,
        fgts: item.fgts,
        consignado: item.consignado,
        fgtsConsignado,
        inss: inssDistribuido[indice],
        irrf: irrfDistribuido[indice],
        totalGeral,
      };
    });

    const totalFgtsRelatorio = round2(
      Array.from(fgtsPorCpf.values()).reduce((acc, valor) => acc + valor, 0),
    );
    const totalConsignadoRelatorio = round2(
      Array.from(consignadoPorCpf.values()).reduce((acc, valor) => acc + valor, 0),
    );
    const fgtsConfere = Math.abs(totalFgtsRelatorio - guia.fgts) <= 0.01;
    const consignadoConfere =
      Math.abs(totalConsignadoRelatorio - guia.consignado) <= 0.01;
    const guiaConfere =
      Math.abs(round2(guia.fgts + guia.consignado) - guia.total) <= 0.01;

    if (!fgtsConfere)
      inconsistencias.push({
        tipo: "total",
        mensagem:
          "FGTS divergente: relatório " +
          totalFgtsRelatorio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) +
          " e guia " +
          guia.fgts.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) +
          ".",
      });
    if (!consignadoConfere)
      inconsistencias.push({
        tipo: "total",
        mensagem:
          "Consignado divergente: relatório " +
          totalConsignadoRelatorio.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }) +
          " e guia " +
          guia.consignado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) +
          ".",
      });
    if (!guiaConfere)
      inconsistencias.push({
        tipo: "total",
        mensagem: "Guia FGTS + Consignado: o total da guia diverge da soma dos componentes.",
      });

    const totalRateavel = round2(
      guia.total + darf.inssEmpregados + darf.irrfEmpregados,
    );
    const totalRateado = round2(
      detalhes.reduce((acc, item) => acc + item.totalGeral, 0),
    );
    if (Math.abs(totalRateado - totalRateavel) > 0.01)
      inconsistencias.push({
        tipo: "total",
        mensagem:
          "O total rateado não confere com os encargos rateáveis. Diferença de " +
          Math.abs(totalRateado - totalRateavel).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }) +
          ".",
      });

    const foraRateio = {
      prolabore: darf.prolabore,
      servicosPj: darf.servicosPj,
      total: round2(darf.prolabore + darf.servicosPj),
    };
    const totalGeral = round2(totalRateavel + foraRateio.total);
    const conferencia: ConferenciaEncargos = {
      fgtsRelatorio: totalFgtsRelatorio,
      fgtsGuia: guia.fgts,
      consignadoRelatorio: totalConsignadoRelatorio,
      consignadoGuia: guia.consignado,
      totalGuia: guia.total,
      totalDarf,
      conferido: fgtsConfere && consignadoConfere && guiaConfere,
    };

    const resultado = inconsistencias.length
      ? null
      : ({
          cnpjs: [
            {
              cnpj: "CONSOLIDADO",
              colaboradores: colaboradores.length,
              tomadores: detalhes.length,
              folha: 0,
              fgtsConsignado: guia.total,
              inss: darf.inssEmpregados,
              irrf: darf.irrfEmpregados,
              totalGeral,
              detalhes,
            },
          ],
          resumo: {
            empresas: 1,
            tomadores: detalhes.length,
            colaboradores: colaboradores.length,
            folha: 0,
            fgtsConsignado: guia.total,
            inss: darf.inssEmpregados,
            irrf: darf.irrfEmpregados,
            totalGeral,
            prolabore: foraRateio.total,
            totalArquivo: totalGeral,
            tipo: "encargos_documentos",
            fgts: guia.fgts,
            consignado: guia.consignado,
            totalRateavel,
            foraRateio,
            conferencia,
            arquivos: Object.values(arquivos).map((arquivo) => arquivo.name),
          },
        } as ResultadoRateio);

    return { resultado, inconsistencias, detalhes, conferencia, foraRateio };
  } catch (error) {
    inconsistencias.push({
      tipo: "total",
      mensagem:
        error instanceof Error ? error.message : "Não foi possível processar os documentos.",
    });
    return {
      resultado: null,
      inconsistencias,
      detalhes: [],
      conferencia: {
        fgtsRelatorio: 0,
        fgtsGuia: 0,
        consignadoRelatorio: 0,
        consignadoGuia: 0,
        totalGuia: 0,
        totalDarf: 0,
        conferido: false,
      },
      foraRateio: { prolabore: 0, servicosPj: 0, total: 0 },
    };
  }
}

export async function exportarExcelEncargos(
  registro: RateioFolhaRegistro,
): Promise<void> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const resumo = registro.resultado.resumo as ResultadoRateio["resumo"] & {
    fgts?: number;
    consignado?: number;
    totalRateavel?: number;
    foraRateio?: { prolabore: number; servicosPj: number; total: number };
    conferencia?: ConferenciaEncargos;
  };
  const detalhes = registro.resultado.cnpjs.flatMap((grupo) =>
    grupo.detalhes.map((item) => item as DetalheEncargos),
  );
  const total = detalhes.reduce(
    (acc, item) => ({
      colaboradores: acc.colaboradores + item.colaboradores,
      fgts: round2(acc.fgts + (item.fgts ?? 0)),
      consignado: round2(acc.consignado + (item.consignado ?? 0)),
      inss: round2(acc.inss + item.inss),
      irrf: round2(acc.irrf + item.irrf),
      geral: round2(acc.geral + item.totalGeral),
    }),
    { colaboradores: 0, fgts: 0, consignado: 0, inss: 0, irrf: 0, geral: 0 },
  );

  const resumoSheet = XLSX.utils.aoa_to_sheet([
    ["RESUMO GERAL"],
    ["Competência", registro.competencia.slice(0, 7)],
    ["Departamentos/Tomadores", registro.quantidade_tomadores],
    ["Colaboradores", registro.quantidade_colaboradores],
    ["FGTS", resumo.fgts ?? total.fgts],
    ["Consignado", resumo.consignado ?? total.consignado],
    ["FGTS + Consignado", registro.total_fgts_consignado],
    ["INSS rateado", registro.total_inss],
    ["IRRF rateado", registro.total_irrf],
    ["Total rateável", resumo.totalRateavel ?? total.geral],
    ["Fora do rateio", resumo.foraRateio?.total ?? 0],
    ["TOTAL GERAL", registro.total_geral],
  ]);
  resumoSheet["!cols"] = [{ wch: 30 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(workbook, resumoSheet, "Resumo Geral");

  const rateioSheet = XLSX.utils.aoa_to_sheet([
    [
      "Departamento/Tomador",
      "Quantidade de colaboradores",
      "FGTS",
      "Consignado",
      "INSS",
      "IRRF",
      "Total",
    ],
    ...detalhes.map((item) => [
      item.tomador,
      item.colaboradores,
      item.fgts ?? 0,
      item.consignado ?? 0,
      item.inss,
      item.irrf,
      item.totalGeral,
    ]),
    [
      "TOTAL",
      total.colaboradores,
      total.fgts,
      total.consignado,
      total.inss,
      total.irrf,
      total.geral,
    ],
  ]);
  rateioSheet["!cols"] = [
    { wch: 42 },
    { wch: 28 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(workbook, rateioSheet, "Rateio por Departamento");

  const fora = resumo.foraRateio ?? { prolabore: 0, servicosPj: 0, total: 0 };
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Descrição", "Valor"],
      ["Pró-labore — código 1099", fora.prolabore],
      ["Serviços PJ — código 1708", fora.servicosPj],
      ["TOTAL FORA DO RATEIO", fora.total],
    ]),
    "Fora do Rateio",
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Conferência", "Relatório", "Guia", "Status"],
      [
        "FGTS",
        resumo.conferencia?.fgtsRelatorio ?? 0,
        resumo.conferencia?.fgtsGuia ?? 0,
        resumo.conferencia?.conferido ? "Conferido" : "Divergente",
      ],
      [
        "Consignado",
        resumo.conferencia?.consignadoRelatorio ?? 0,
        resumo.conferencia?.consignadoGuia ?? 0,
        resumo.conferencia?.conferido ? "Conferido" : "Divergente",
      ],
    ]),
    "Conferência",
  );

  XLSX.writeFile(
    workbook,
    "rateio-encargos-" + registro.competencia.slice(0, 7) + ".xlsx",
  );
}
