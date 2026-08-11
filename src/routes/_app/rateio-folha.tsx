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
  MODOS_RATEIO,
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


export const Route = createFileRoute("/_app/rateio-folha")({
  head: () => ({
    meta: [
      { title: "Rateio de Folha — Luxe People OS" },
      { name: "description", content: "Processamento e histórico do rateio da folha por CNPJ e tomador." },
    ],
  }),
  component: RateioFolhaPage,
});

const competenciaAtual = new Date().toISOString().slice(0, 7);

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
  const [modo, setModo] = useState<ModoRateio>("completo");
  const [arquivoLiquidos, setArquivoLiquidos] = useState<File | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioLiquidos | null>(null);
  const [lendoLiquidos, setLendoLiquidos] = useState(false);

  async function selecionarLiquidos(file: File | null) {
    setArquivoLiquidos(file);
    setRelatorio(null);
    if (!file) return;
    setLendoLiquidos(true);
    try {
      const dados = await importarRelatorioLiquidos(file);
      setRelatorio(dados);
      toast.success(dados.tomadores.length + " tomadores identificados no relatório.");
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

  const progresso = (folha.length ? 50 : 0) + (rateios.length ? 50 : 0);

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

  function processar() {
    if (!competencia) return toast.error("Selecione a competência.");
    if (!folha.length || !rateios.length)
      return toast.error("Importe as planilhas da folha e do rateio.");
    const processado = processarRateio(folha, rateios, modo);
    setInconsistencias(processado.inconsistencias);
    setResultado(processado.resultado);
    setSalvoAtual(null);
    if (processado.inconsistencias.length)
      toast.error("O processamento foi bloqueado por inconsistências.");
    else toast.success("Rateio processado e conferido com sucesso.");
  }

  const salvarMutation = useMutation({
    mutationFn: () =>
      salvarRateio({
        competencia,
        arquivoFolhaNome: arquivoFolha?.name ?? "reprocessamento",
        arquivoRateioNome: arquivoRateio?.name ?? "reprocessamento",
        folha,
        rateios,
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
    setArquivoFolha(null);
    setArquivoRateio(null);
    setFolha([]);
    setRateios([]);
    setResultado(null);
    setInconsistencias([]);
    setSalvoAtual(null);
    setTab("novo");
  }

  function reprocessar(registro: RateioFolhaRegistro) {
    setCompetencia(registro.competencia.slice(0, 7));
    setArquivoFolha(null);
    setArquivoRateio(null);
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
      description="Distribua folha e encargos por CNPJ e tomador com conferência automática."
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
          <TabsTrigger value="liquidos">Relatório de Líquidos</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="novo" className="mt-5 space-y-5">
          <Card className="border-border/60 p-5 shadow-elegant">
            <h2 className="font-semibold">Escopo do rateio</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Escolha se o processamento deve considerar a folha, os encargos ou ambos.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {MODOS_RATEIO.map((item) => (
                <button
                  key={item.valor}
                  type="button"
                  aria-pressed={modo === item.valor}
                  onClick={() => {
                    setModo(item.valor);
                    setResultado(null);
                    setSalvoAtual(null);
                  }}
                  className={
                    "rounded-lg border p-4 text-left transition-colors " +
                    (modo === item.valor
                      ? "border-gold bg-accent/40 shadow-gold"
                      : "border-border hover:border-gold/50 hover:bg-accent/20")
                  }
                >
                  <span className="block text-sm font-semibold">{item.titulo}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{item.descricao}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="border-border/60 p-5 shadow-elegant">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Arquivos do processamento</h2>
                <p className="text-sm text-muted-foreground">
                  Importe a folha e a distribuição por tomador.
                </p>
              </div>
              <Badge variant={progresso === 100 ? "default" : "secondary"}>{progresso}% pronto</Badge>
            </div>
            <Progress value={progresso} className="mb-6 h-2" />


            <div className="grid gap-5 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="competencia">Competência *</Label>
                <Input
                  id="competencia"
                  type="month"
                  value={competencia}
                  onChange={(event) => setCompetencia(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">Selecione o mês e o ano.</p>
              </div>

              <UploadCard
                id="arquivo-folha"
                titulo="Upload da Folha"
                descricao="Matrícula, Nome, CNPJ, Folha, FGTS, Consignado, INSS e IRRF"
                arquivo={arquivoFolha}
                linhas={folha.length}
                carregando={lendoFolha}
                onChange={selecionarFolha}
              />

              <UploadCard
                id="arquivo-rateio"
                titulo="Upload do Rateio"
                descricao="Matrícula, Tomador e Percentual"
                arquivo={arquivoRateio}
                linhas={rateios.length}
                carregando={lendoRateio}
                onChange={selecionarRateio}
              />
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                size="lg"
                onClick={processar}
                disabled={lendoFolha || lendoRateio || !folha.length || !rateios.length}
                className="bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
              >
                <Play className="mr-2 h-4 w-4" /> Processar Rateio
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
                  {salvoAtual && (
                    <>
                      <Button variant="outline" onClick={() => exportarExcel(salvoAtual)}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
                      </Button>
                      <Button variant="outline" onClick={() => exportarPdf(salvoAtual)}>
                        <Download className="mr-2 h-4 w-4" /> PDF
                      </Button>
                    </>
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
              <RateioResultado resultado={resultado} />
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
                    <th className="px-3 py-3 text-center">Tomadores</th>
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

function UploadCard(props: {
  id: string;
  titulo: string;
  descricao: string;
  arquivo: File | null;
  linhas: number;
  carregando: boolean;
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
          {props.arquivo ? props.arquivo.name : "Selecionar arquivo Excel"}
        </span>
        <span className="mt-1 text-xs text-muted-foreground">
          {props.linhas ? props.linhas + " linhas importadas" : props.descricao}
        </span>
      </label>
      <Input
        id={props.id}
        type="file"
        accept=".xlsx,.xls"
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
