import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  History,
  Loader2,
  Play,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { RateioResultado } from "@/components/rateio/rateio-resultado";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import {
  excluirRateio,
  exportarExcel,
  exportarPdf,
  formatarCompetencia,
  formatarMoeda,
  importarFolha,
  importarRateio,
  importarRelatorioLiquidos,
  listarRateios,
  processarRateio,
  salvarRateio,
  type FolhaLinha,
  type InconsistenciaRateio,
  type ModoRateio,
  type RateioFolhaRegistro,
  type RateioLinha,
  type RelatorioLiquidos,
  type ResultadoRateio,
} from "@/lib/rateio-folha-api";

import {
  processarEncargosDocumentos,
  type ProcessamentoEncargos,
} from "@/lib/encargos-documentos";

export const Route = createFileRoute("/_app/rateio-folha")({
  head: () => ({
    meta: [
      { title: "Rateio de Folha — Luxe People OS" },
      { name: "description", content: "Processamento e histórico do rateio da folha por Departamento/Tomador." },
    ],
  }),
  component: RateioFolhaPage,
});

const competenciaAtual = new Date().toISOString().slice(0, 7);

const OPCOES_RATEIO = [
  {
    valor: "folha" as const,
    titulo: "Folha",
    descricao: "Rateia somente os valores da folha por Departamento/Tomador.",
  },
  {
    valor: "encargos" as const,
    titulo: "Encargos",
    descricao: "Rateia FGTS, consignado, INSS e IRRF por Departamento/Tomador.",
  },
];



function resultadoDoRelatorioLiquidos(relatorio: RelatorioLiquidos): ResultadoRateio {
  const grupos = new Map<string, ResultadoRateio["cnpjs"][number]>();

  for (const item of relatorio.tomadores) {
    const cnpj = item.cnpj || "CNPJ não informado";
    const atual = grupos.get(cnpj) ?? {
      cnpj,
      colaboradores: 0,
      tomadores: 0,
      folha: 0,
      fgtsConsignado: 0,
      inss: 0,
      irrf: 0,
      totalGeral: 0,
      detalhes: [],
    };

    atual.colaboradores += item.colaboradores;
    atual.tomadores += 1;
    atual.folha += item.total;
    atual.totalGeral += item.total;
    atual.detalhes.push({
      tomador: item.tomador,
      colaboradores: item.colaboradores,
      folha: item.total,
      fgtsConsignado: 0,
      inss: 0,
      irrf: 0,
      totalGeral: item.total,
    });
    grupos.set(cnpj, atual);
  }

  const cnpjs = Array.from(grupos.values());
  return {
    cnpjs,
    resumo: {
      empresas: cnpjs.length,
      tomadores: relatorio.tomadores.length,
      colaboradores: relatorio.totalColaboradores,
      folha: relatorio.totalRateado,
      fgtsConsignado: 0,
      inss: 0,
      irrf: 0,
      totalGeral: relatorio.totalGeral,
      prolabore: relatorio.totalProlabore,
      totalArquivo: relatorio.totalGeral,
    },
  };
}

function origensDoRelatorioLiquidos(relatorio: RelatorioLiquidos): {
  folha: FolhaLinha[];
  rateios: RateioLinha[];
} {
  const folhaOrigem: FolhaLinha[] = [];
  const rateioOrigem: RateioLinha[] = [];

  relatorio.tomadores.forEach((item, tomadorIndex) => {
    const quantidade = Math.max(1, item.colaboradores);
    const totalCentavos = Math.round(item.total * 100);
    const baseCentavos = Math.trunc(totalCentavos / quantidade);
    const centavosRestantes = totalCentavos - baseCentavos * quantidade;

    for (let colaboradorIndex = 0; colaboradorIndex < quantidade; colaboradorIndex += 1) {
      const matricula = `LIQ-${tomadorIndex + 1}-${colaboradorIndex + 1}`;
      const valorFolha =
        (baseCentavos + (colaboradorIndex < centavosRestantes ? 1 : 0)) / 100;
      folhaOrigem.push({
        matricula,
        nome: `Colaborador importado ${colaboradorIndex + 1}`,
        cnpj: item.cnpj,
        valorFolha,
        fgts: 0,
        consignado: 0,
        inss: 0,
        irrf: 0,
      });
      rateioOrigem.push({
        matricula,
        tomador: item.tomador,
        percentual: 100,
      });
    }
  });

  return { folha: folhaOrigem, rateios: rateioOrigem };
}

function RateioFolhaPage() {
  const queryClient = useQueryClient();
  const { isAdminPrincipal } = useAuth();
  const [tab, setTab] = useState("novo");
  const [competencia, setCompetencia] = useState(competenciaAtual);
  const [arquivoFolha, setArquivoFolha] = useState<File | null>(null);
  const [arquivoRateio, setArquivoRateio] = useState<File | null>(null);
  const [folha, setFolha] = useState<FolhaLinha[]>([]);
  const [rateios, setRateios] = useState<RateioLinha[]>([]);
  const [resultado, setResultado] = useState<ResultadoRateio | null>(null);
  const [inconsistencias, setInconsistencias] = useState<InconsistenciaRateio[]>([]);
  const [salvoAtual, setSalvoAtual] = useState<RateioFolhaRegistro | null>(null);
  const [lendoFolha, setLendoFolha] = useState(false);
  const [lendoRateio, setLendoRateio] = useState(false);
  const [filtroCompetencia, setFiltroCompetencia] = useState("");
  const [modo, setModo] = useState<ModoRateio>("folha");
  const [arquivoLiquidos, setArquivoLiquidos] = useState<File | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioLiquidos | null>(null);
  const [lendoLiquidos, setLendoLiquidos] = useState(false);
  const [arquivoFgtsMensal, setArquivoFgtsMensal] = useState<File | null>(null);
  const [arquivoConsignado, setArquivoConsignado] = useState<File | null>(null);
  const [arquivoGuiaFgts, setArquivoGuiaFgts] = useState<File | null>(null);
  const [arquivoDarf, setArquivoDarf] = useState<File | null>(null);
  const [processandoEncargos, setProcessandoEncargos] = useState(false);
  const [processamentoEncargos, setProcessamentoEncargos] = useState<ProcessamentoEncargos | null>(null);

  async function selecionarLiquidos(file: File | null) {
    setArquivoLiquidos(file);
    setRelatorio(null);
    if (!file) return;
    setLendoLiquidos(true);
    try {
      const dados = await importarRelatorioLiquidos(file);
      setRelatorio(dados);
      setResultado(null);
      setSalvoAtual(null);
      const competenciaArquivo = dados.competencia?.match(/(\d{2})\D+(\d{4})/);
      if (competenciaArquivo) setCompetencia(competenciaArquivo[2] + "-" + competenciaArquivo[1]);
      toast.success(dados.tomadores.length + " departamentos/tomadores identificados no relatório.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível ler o relatório de líquidos.",
      );
    } finally {
      setLendoLiquidos(false);
    }
  }


  const { data: historico = [], isLoading: carregandoHistorico } = useQuery({
    queryKey: ["rateios-folha"],
    queryFn: listarRateios,
  });

  const historicoFiltrado = useMemo(
    () =>
      historico.filter(
        (item) => !filtroCompetencia || item.competencia.slice(0, 7) === filtroCompetencia,
      ),
    [historico, filtroCompetencia],
  );

  const progresso =
    modo === "folha"
      ? relatorio
        ? 100
        : 0
      : [arquivoLiquidos, arquivoFgtsMensal, arquivoConsignado, arquivoGuiaFgts, arquivoDarf].filter(Boolean).length * 20;
  const origensLiquidos = useMemo(
    () => (relatorio ? origensDoRelatorioLiquidos(relatorio) : { folha: [], rateios: [] }),
    [relatorio],
  );
  const registroExportacao = useMemo<RateioFolhaRegistro | null>(() => {
    if (salvoAtual) return salvoAtual;
    if (!resultado) return null;
    return {
      id: "previsualizacao",
      competencia: competencia + "-01",
      arquivo_folha_nome:
        modo === "folha"
          ? arquivoLiquidos?.name ?? null
          : [arquivoLiquidos, arquivoFgtsMensal, arquivoConsignado]
              .filter((arquivo): arquivo is File => Boolean(arquivo))
              .map((arquivo) => arquivo.name)
              .join(", ") || null,
      arquivo_rateio_nome:
        modo === "folha"
          ? arquivoLiquidos?.name ?? null
          : [arquivoGuiaFgts, arquivoDarf]
              .filter((arquivo): arquivo is File => Boolean(arquivo))
              .map((arquivo) => arquivo.name)
              .join(", ") || null,
      quantidade_empresas: resultado.resumo.empresas,
      quantidade_tomadores: resultado.resumo.tomadores,
      quantidade_colaboradores: resultado.resumo.colaboradores,
      total_folha: resultado.resumo.folha,
      total_fgts_consignado: resultado.resumo.fgtsConsignado,
      total_inss: resultado.resumo.inss,
      total_irrf: resultado.resumo.irrf,
      total_geral: resultado.resumo.totalGeral,
      resultado,
      folha_origem: modo === "folha" ? origensLiquidos.folha : folha,
      rateio_origem: modo === "folha" ? origensLiquidos.rateios : rateios,
      created_at: new Date().toISOString(),
      created_by: null,
    };
  }, [
    arquivoConsignado,
    arquivoDarf,
    arquivoFgtsMensal,
    arquivoFolha,
    arquivoGuiaFgts,
    arquivoLiquidos,
    arquivoRateio,
    competencia,
    folha,
    modo,
    origensLiquidos,
    rateios,
    resultado,
    salvoAtual,
  ]);

  async function selecionarFolha(file: File | null) {
    setArquivoFolha(file);
    setResultado(null);
    setSalvoAtual(null);
    if (!file) return setFolha([]);
    setLendoFolha(true);
    try {
      const linhas = await importarFolha(file);
      setFolha(linhas);
      toast.success(linhas.length + " linhas da folha importadas.");
    } catch (error) {
      setFolha([]);
      toast.error(error instanceof Error ? error.message : "Não foi possível ler a planilha da folha.");
    } finally {
      setLendoFolha(false);
    }
  }

  async function selecionarRateio(file: File | null) {
    setArquivoRateio(file);
    setResultado(null);
    setSalvoAtual(null);
    if (!file) return setRateios([]);
    setLendoRateio(true);
    try {
      const linhas = await importarRateio(file);
      setRateios(linhas);
      toast.success(linhas.length + " linhas de rateio importadas.");
    } catch (error) {
      setRateios([]);
      toast.error(error instanceof Error ? error.message : "Não foi possível ler a planilha de rateio.");
    } finally {
      setLendoRateio(false);
    }
  }

  async function processar() {
    if (!competencia) return toast.error("Selecione a competência.");

    if (modo === "folha") {
      if (!relatorio) return toast.error("Envie o arquivo de líquidos para processar a Folha.");
      setInconsistencias([]);
      setProcessamentoEncargos(null);
      setResultado(resultadoDoRelatorioLiquidos(relatorio));
      setSalvoAtual(null);
      toast.success("Arquivo de líquidos processado e rateado por Departamento/Tomador.");
      return;
    }

    if (
      !arquivoLiquidos ||
      !arquivoFgtsMensal ||
      !arquivoConsignado ||
      !arquivoGuiaFgts ||
      !arquivoDarf
    ) {
      return toast.error("Envie os cinco documentos obrigatórios dos encargos.");
    }

    setProcessandoEncargos(true);
    setResultado(null);
    setSalvoAtual(null);
    try {
      const processado = await processarEncargosDocumentos({
        liquidos: arquivoLiquidos,
        fgtsMensal: arquivoFgtsMensal,
        consignado: arquivoConsignado,
        guiaFgts: arquivoGuiaFgts,
        darf: arquivoDarf,
      });
      setProcessamentoEncargos(processado);
      setInconsistencias(processado.inconsistencias);
      setResultado(processado.resultado);
      if (processado.inconsistencias.length) {
        toast.error("O processamento foi bloqueado. Confira as inconsistências por arquivo.");
      } else {
        toast.success("Encargos processados e conferidos por Departamento/Tomador.");
      }
    } finally {
      setProcessandoEncargos(false);
    }
  }

  const salvarMutation = useMutation({
    mutationFn: () =>
      salvarRateio({
        competencia,
        arquivoFolhaNome:
          modo === "folha"
            ? arquivoLiquidos?.name ?? "relatorio-liquidos"
            : [arquivoLiquidos, arquivoFgtsMensal, arquivoConsignado]
                .filter((arquivo): arquivo is File => Boolean(arquivo))
                .map((arquivo) => arquivo.name)
                .join(", "),
        arquivoRateioNome:
          modo === "folha"
            ? arquivoLiquidos?.name ?? "relatorio-liquidos"
            : [arquivoGuiaFgts, arquivoDarf]
                .filter((arquivo): arquivo is File => Boolean(arquivo))
                .map((arquivo) => arquivo.name)
                .join(", "),
        folha: modo === "folha" ? origensLiquidos.folha : folha,
        rateios: modo === "folha" ? origensLiquidos.rateios : rateios,
        resultado: resultado!,
      }),
    onSuccess: (registro) => {
      setSalvoAtual(registro);
      queryClient.invalidateQueries({ queryKey: ["rateios-folha"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-financeiro"] });
      toast.success("Rateio finalizado e salvo no histórico.");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Erro ao salvar o rateio."),
  });

  const excluirMutation = useMutation({
    mutationFn: excluirRateio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rateios-folha"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-financeiro"] });
      toast.success("Processamento excluído.");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Erro ao excluir."),
  });

  function novoProcessamento() {
    setCompetencia(competenciaAtual);
    setModo("folha");
    setArquivoFolha(null);
    setArquivoRateio(null);
    setArquivoLiquidos(null);
    setRelatorio(null);
    setArquivoFgtsMensal(null);
    setArquivoConsignado(null);
    setArquivoGuiaFgts(null);
    setArquivoDarf(null);
    setProcessamentoEncargos(null);
    setFolha([]);
    setRateios([]);
    setResultado(null);
    setInconsistencias([]);
    setSalvoAtual(null);
    setTab("novo");
  }

  function reprocessar(registro: RateioFolhaRegistro) {
    setCompetencia(registro.competencia.slice(0, 7));
    setModo(
      registro.total_fgts_consignado + registro.total_inss + registro.total_irrf > 0
        ? "encargos"
        : "folha",
    );
    setArquivoFolha(null);
    setArquivoRateio(null);
    setArquivoLiquidos(null);
    setRelatorio(null);
    setFolha(registro.folha_origem ?? []);
    setRateios(registro.rateio_origem ?? []);
    setResultado(null);
    setInconsistencias([]);
    setSalvoAtual(null);
    setTab("novo");
    toast.info("Dados carregados. Clique em Processar Rateio para gerar uma nova versão.");
  }

  return (
    <PageShell
      title="Rateio de Folha"
      description="Distribua folha e encargos por Departamento/Tomador com conferência automática."
      icon={<WalletCards className="h-5 w-5 text-gold-foreground" />}
      actions={
        <div className="flex gap-2">
          <Button onClick={novoProcessamento}>
            <Upload className="mr-2 h-4 w-4" /> Novo Rateio
          </Button>
        </div>
      }
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="novo">Novo Rateio</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="novo" className="mt-5 space-y-5">
          <Card className="border-border/60 p-5 shadow-elegant">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Arquivos do processamento</h2>
                <p className="text-sm text-muted-foreground">
                  Escolha Folha ou Encargos e importe os arquivos para processar.
                </p>
              </div>
              <Badge variant={progresso === 100 ? "default" : "secondary"}>{progresso}% pronto</Badge>
            </div>
            <div className="mb-6 space-y-2">
              <Label>Opção de rateio *</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {OPCOES_RATEIO.map((item) => (
                  <button
                    key={item.valor}
                    type="button"
                    aria-pressed={modo === item.valor}
                    onClick={() => {
                      setModo(item.valor);
                      setResultado(null);
                      setSalvoAtual(null);
                      setProcessamentoEncargos(null);
                    }}
                    className={
                      "rounded-lg border p-4 text-left transition-colors " +
                      (modo === item.valor
                        ? "border-gold bg-accent/40 shadow-gold"
                        : "border-border hover:border-gold/50 hover:bg-accent/20")
                    }
                  >
                    <span className="block text-sm font-semibold">{item.titulo}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {item.descricao}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <Progress value={progresso} className="mb-6 h-2" />

            <div
              className={
                "grid gap-5 " + (modo === "folha" ? "lg:grid-cols-2" : "lg:grid-cols-3")
              }
            >
              <div className="space-y-2">
                <Label htmlFor="competencia">Competência *</Label>
                <Input
                  id="competencia"
                  type="month"
                  value={competencia}
                  onChange={(event) => setCompetencia(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  A competência também será identificada no arquivo quando estiver disponível.
                </p>
              </div>

              {modo === "folha" ? (
                <UploadCard
                  id="arquivo-liquidos"
                  titulo="Arquivo de Líquidos"
                  descricao="Relatório de Líquidos por serviço (.xls, .xlsx ou .csv)"
                  arquivo={arquivoLiquidos}
                  linhas={relatorio?.totalColaboradores ?? 0}
                  carregando={lendoLiquidos}
                  accept=".xls,.xlsx,.csv"
                  onChange={selecionarLiquidos}
                />
              ) : (
                <>
                  <UploadCard
                    id="encargos-liquidos"
                    titulo="Relatório de Líquidos por serviço"
                    descricao="Base de CPF, Departamento/Tomador e valor líquido"
                    arquivo={arquivoLiquidos}
                    linhas={relatorio?.totalColaboradores ?? 0}
                    carregando={lendoLiquidos}
                    accept=".xls,.xlsx,.csv"
                    onChange={selecionarLiquidos}
                  />
                  <UploadCard
                    id="encargos-fgts"
                    titulo="Relatório do FGTS Mensal"
                    descricao="PDF com FGTS individual por colaborador"
                    arquivo={arquivoFgtsMensal}
                    linhas={0}
                    carregando={false}
                    accept=".pdf"
                    onChange={(file) => {
                      setArquivoFgtsMensal(file);
                      setResultado(null);
                      setSalvoAtual(null);
                    }}
                  />
                  <UploadCard
                    id="encargos-consignado"
                    titulo="Relatório do FGTS Consignado"
                    descricao="PDF com parcelas por CPF"
                    arquivo={arquivoConsignado}
                    linhas={0}
                    carregando={false}
                    accept=".pdf"
                    onChange={(file) => {
                      setArquivoConsignado(file);
                      setResultado(null);
                      setSalvoAtual(null);
                    }}
                  />
                  <UploadCard
                    id="encargos-guia-fgts"
                    titulo="Guia FGTS + Consignado"
                    descricao="PDF usado para conferir os totais"
                    arquivo={arquivoGuiaFgts}
                    linhas={0}
                    carregando={false}
                    accept=".pdf"
                    onChange={(file) => {
                      setArquivoGuiaFgts(file);
                      setResultado(null);
                      setSalvoAtual(null);
                    }}
                  />
                  <UploadCard
                    id="encargos-darf"
                    titulo="DARF Previdência + IRRF"
                    descricao="PDF com os códigos 1082, 1099, 0561 e 1708"
                    arquivo={arquivoDarf}
                    linhas={0}
                    carregando={false}
                    accept=".pdf"
                    onChange={(file) => {
                      setArquivoDarf(file);
                      setResultado(null);
                      setSalvoAtual(null);
                    }}
                  />
                </>
              )}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                size="lg"
                onClick={processar}
                disabled={
                  modo === "folha"
                    ? lendoLiquidos || !relatorio
                    : processandoEncargos ||
                      !arquivoLiquidos ||
                      !arquivoFgtsMensal ||
                      !arquivoConsignado ||
                      !arquivoGuiaFgts ||
                      !arquivoDarf
                }
                className="bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
              >
                <Play className="mr-2 h-4 w-4" />
                {processandoEncargos ? "Processando documentos..." : modo === "folha" ? "Processar Folha" : "Processar Encargos"}
              </Button>
            </div>
          </Card>

          {!!inconsistencias.length && (
            <Card className="border-destructive/40 bg-destructive/5 p-5">
              <div className="mb-4 flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
                <div>
                  <h3 className="font-semibold text-destructive">Processamento bloqueado</h3>
                  <p className="text-sm text-muted-foreground">
                    Corrija as planilhas e importe novamente. Foram encontradas {inconsistencias.length} inconsistências.
                  </p>
                </div>
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {inconsistencias.map((item, index) => (
                  <div key={index} className="rounded-md border border-destructive/20 bg-background px-3 py-2 text-sm">
                    <Badge variant="destructive" className="mr-2">{item.tipo}</Badge>
                    {item.mensagem}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {resultado && (
            <>
              <Card className="flex flex-wrap items-center justify-between gap-3 border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Todos os percentuais, CNPJs e totais foram conferidos.
                </div>
                <div className="flex flex-wrap gap-2">
                  {registroExportacao && (
                    <Button variant="outline" onClick={() => exportarExcel(registroExportacao)}>
                      <FileSpreadsheet className="mr-2 h-4 w-4" /> Exportar Excel
                    </Button>
                  )}
                  {salvoAtual && (
                    <Button variant="outline" onClick={() => exportarPdf(salvoAtual)}>
                      <Download className="mr-2 h-4 w-4" /> PDF
                    </Button>
                  )}
                  <Button
                    onClick={() => salvarMutation.mutate()}
                    disabled={salvarMutation.isPending || !!salvoAtual}
                  >
                    {salvarMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {salvoAtual ? "Salvo no histórico" : "Finalizar e salvar"}
                  </Button>
                </div>
              </Card>
              {modo === "encargos" && processamentoEncargos ? (
                <EncargosResultado dados={processamentoEncargos} />
              ) : (
                <RateioResultado resultado={resultado} modo={modo} />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="historico" className="mt-5">
          <Card className="border-border/60 shadow-elegant">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
              <div>
                <h2 className="font-semibold">Histórico de processamentos</h2>
                <p className="text-sm text-muted-foreground">
                  Consulte, exporte ou carregue uma competência para reprocessar.
                </p>
              </div>
              <Input
                type="month"
                value={filtroCompetencia}
                onChange={(event) => setFiltroCompetencia(event.target.value)}
                className="w-48"
                aria-label="Filtrar competência"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3">Competência</th>
                    <th className="px-3 py-3 text-center">CNPJs</th>
                    <th className="px-3 py-3 text-center">Departamentos/Tomadores</th>
                    <th className="px-3 py-3 text-center">Colaboradores</th>
                    <th className="px-5 py-3 text-right">Total geral</th>
                    <th className="px-5 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {carregandoHistorico ? (
                    <tr><td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">Carregando...</td></tr>
                  ) : !historicoFiltrado.length ? (
                    <tr><td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">Nenhum processamento encontrado.</td></tr>
                  ) : (
                    historicoFiltrado.map((item) => (
                      <HistoricoRow
                        key={item.id}
                        item={item}
                        podeExcluir={isAdminPrincipal}
                        excluindo={excluirMutation.isPending}
                        onReprocessar={() => reprocessar(item)}
                        onExcluir={() => {
                          if (window.confirm("Excluir este processamento do histórico?"))
                            excluirMutation.mutate(item.id);
                        }}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}


function EncargosResultado({ dados }: { dados: ProcessamentoEncargos }) {
  if (!dados.resultado) return null;
  const resumo = dados.resultado.resumo as ResultadoRateio["resumo"] & {
    fgts?: number;
    consignado?: number;
    totalRateavel?: number;
  };
  const cards = [
    ["Departamentos/Tomadores", resumo.tomadores.toLocaleString("pt-BR")],
    ["Colaboradores", resumo.colaboradores.toLocaleString("pt-BR")],
    ["FGTS", formatarMoeda(resumo.fgts ?? 0)],
    ["Consignado", formatarMoeda(resumo.consignado ?? 0)],
    ["FGTS + Consignado", formatarMoeda(resumo.fgtsConsignado)],
    ["INSS rateado", formatarMoeda(resumo.inss)],
    ["IRRF rateado", formatarMoeda(resumo.irrf)],
    ["Fora do rateio", formatarMoeda(dados.foraRateio.total)],
    ["Total geral", formatarMoeda(resumo.totalGeral)],
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([rotulo, valor]) => (
          <Card key={rotulo} className="border-border/60 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {rotulo}
            </p>
            <p className="mt-2 text-xl font-semibold">{valor}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden border-border/60 shadow-elegant">
        <div className="border-b border-border p-5">
          <h3 className="font-semibold">Resumo por Departamento/Tomador</h3>
          <p className="text-sm text-muted-foreground">
            Valores conferidos na tela antes da exportação.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3">Departamento/Tomador</th>
                <th className="px-3 py-3 text-center">Colaboradores</th>
                <th className="px-3 py-3 text-right">FGTS</th>
                <th className="px-3 py-3 text-right">Consignado</th>
                <th className="px-3 py-3 text-right">INSS</th>
                <th className="px-3 py-3 text-right">IRRF</th>
                <th className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {dados.detalhes.map((item) => (
                <tr key={item.tomador} className="border-b border-border/60">
                  <td className="px-5 py-3 font-medium">{item.tomador}</td>
                  <td className="px-3 py-3 text-center">{item.colaboradores}</td>
                  <td className="px-3 py-3 text-right">{formatarMoeda(item.fgts)}</td>
                  <td className="px-3 py-3 text-right">{formatarMoeda(item.consignado)}</td>
                  <td className="px-3 py-3 text-right">{formatarMoeda(item.inss)}</td>
                  <td className="px-3 py-3 text-right">{formatarMoeda(item.irrf)}</td>
                  <td className="px-5 py-3 text-right font-semibold">
                    {formatarMoeda(item.totalGeral)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="border-border/60 p-5">
          <h3 className="font-semibold">Valores fora do rateio</h3>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span>Pró-labore — DARF 1099</span>
              <strong>{formatarMoeda(dados.foraRateio.prolabore)}</strong>
            </div>
            <div className="flex justify-between gap-4">
              <span>Serviços PJ — DARF 1708</span>
              <strong>{formatarMoeda(dados.foraRateio.servicosPj)}</strong>
            </div>
            <div className="flex justify-between gap-4 border-t border-border pt-2">
              <span>Total fora do rateio</span>
              <strong>{formatarMoeda(dados.foraRateio.total)}</strong>
            </div>
          </div>
        </Card>

        <Card className="border-border/60 p-5">
          <h3 className="font-semibold">Conferência Relatórios x Guias</h3>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span>FGTS: relatório / guia</span>
              <strong>
                {formatarMoeda(dados.conferencia.fgtsRelatorio)} /{" "}
                {formatarMoeda(dados.conferencia.fgtsGuia)}
              </strong>
            </div>
            <div className="flex justify-between gap-4">
              <span>Consignado: relatório / guia</span>
              <strong>
                {formatarMoeda(dados.conferencia.consignadoRelatorio)} /{" "}
                {formatarMoeda(dados.conferencia.consignadoGuia)}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border pt-2">
              <span>Status</span>
              <Badge variant={dados.conferencia.conferido ? "default" : "destructive"}>
                {dados.conferencia.conferido ? "Conferido" : "Divergente"}
              </Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function UploadCard(props: {
  id: string;
  titulo: string;
  descricao: string;
  arquivo: File | null;
  linhas: number;
  carregando: boolean;
  accept?: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={props.id}>{props.titulo} *</Label>
      <label
        htmlFor={props.id}
        className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center transition-colors hover:border-gold/50 hover:bg-accent/30"
      >
        {props.carregando ? (
          <Loader2 className="mb-2 h-6 w-6 animate-spin text-gold" />
        ) : (
          <FileSpreadsheet className="mb-2 h-6 w-6 text-gold" />
        )}
        <span className="text-sm font-medium">
          {props.arquivo ? props.arquivo.name : "Selecionar arquivo"}
        </span>
        <span className="mt-1 text-xs text-muted-foreground">
          {props.linhas ? props.linhas + " linhas importadas" : props.descricao}
        </span>
      </label>
      <Input
        id={props.id}
        type="file"
        accept={props.accept ?? ".xlsx,.xls"}
        className="sr-only"
        onChange={(event) => props.onChange(event.target.files?.[0] ?? null)}
      />
    </div>
  );
}

function HistoricoRow(props: {
  item: RateioFolhaRegistro;
  podeExcluir: boolean;
  excluindo: boolean;
  onReprocessar: () => void;
  onExcluir: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <tr className="border-b border-border/60">
        <td className="px-5 py-4 font-medium">{formatarCompetencia(props.item.competencia)}</td>
        <td className="px-3 py-4 text-center">{props.item.quantidade_empresas}</td>
        <td className="px-3 py-4 text-center">{props.item.quantidade_tomadores}</td>
        <td className="px-3 py-4 text-center">{props.item.quantidade_colaboradores}</td>
        <td className="px-5 py-4 text-right font-semibold">{formatarMoeda(props.item.total_geral)}</td>
        <td className="px-5 py-4">
          <div className="flex justify-end gap-1">
            <Button size="icon" variant="ghost" title="Visualizar" onClick={() => setAberto(!aberto)}>
              <History className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" title="Reprocessar" onClick={props.onReprocessar}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" title="Exportar Excel" onClick={() => exportarExcel(props.item)}>
              <FileSpreadsheet className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" title="Exportar PDF" onClick={() => exportarPdf(props.item)}>
              <Download className="h-4 w-4" />
            </Button>
            {props.podeExcluir && (
              <Button
                size="icon"
                variant="ghost"
                title="Excluir"
                disabled={props.excluindo}
                onClick={props.onExcluir}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </td>
      </tr>
      {aberto && (
        <tr className="border-b border-border bg-muted/15">
          <td colSpan={6} className="p-5">
            <RateioResultado resultado={props.item.resultado} />
          </td>
        </tr>
      )}
    </>
  );
}
