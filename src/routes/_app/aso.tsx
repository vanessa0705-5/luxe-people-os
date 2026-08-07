import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Download,
  HeartPulse,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AsoFormSheet } from "@/components/aso/aso-form-sheet";
import { useAuth } from "@/lib/auth-context";
import {
  RESULTADO_LABELS,
  RESULTADO_ORDER,
  SITUACAO_ASO_LABELS,
  TIPO_EXAME_LABELS,
  TIPO_EXAME_ORDER,
  deleteAso,
  formatarData,
  getAsosResumo,
  getUrlDocumentoSst,
  listAsosPaged,
  situacaoAso,
  type AsoComRelacoes,
  type ResultadoAso,
  type SituacaoAso,
  type TipoExameAso,
} from "@/lib/aso-api";

export const Route = createFileRoute("/_app/aso")({
  head: () => ({
    meta: [
      { title: "ASO — Atestado de Saúde Ocupacional" },
      {
        name: "description",
        content:
          "Controle de Atestados de Saúde Ocupacional: exames, resultados, vencimentos e documentos.",
      },
      { property: "og:title", content: "ASO — Atestado de Saúde Ocupacional" },
      {
        property: "og:description",
        content: "Gestão completa de ASOs, resultados e prazos de validade.",
      },
    ],
  }),
  component: AsoPage,
});

const PAGE_SIZE = 10;

function situacaoBadge(situacao: SituacaoAso) {
  const classes: Record<SituacaoAso, string> = {
    vigente: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    a_vencer: "border-amber-500/40 bg-amber-500/10 text-amber-400",
    vencido: "border-destructive/40 bg-destructive/10 text-destructive",
    sem_vencimento: "border-border bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={classes[situacao]}>
      {SITUACAO_ASO_LABELS[situacao]}
    </Badge>
  );
}

function AsoPage() {
  const { canManageSst, canDelete } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [tipoExame, setTipoExame] = useState<TipoExameAso | "todos">("todos");
  const [resultado, setResultado] = useState<ResultadoAso | "todos">("todos");
  const [situacao, setSituacao] = useState<SituacaoAso | "todos">("todos");
  const [unidade, setUnidade] = useState<string>("todos");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [registro, setRegistro] = useState<AsoComRelacoes | null>(null);
  const [paraExcluir, setParaExcluir] = useState<AsoComRelacoes | null>(null);

  const filtros = { search, tipoExame, resultado, situacao, unidade, page, pageSize: PAGE_SIZE };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["asos", filtros],
    queryFn: () => listAsosPaged(filtros),
  });

  const { data: resumo } = useQuery({ queryKey: ["asos", "resumo"], queryFn: getAsosResumo });

  const deleteMut = useMutation({
    mutationFn: (aso: AsoComRelacoes) => deleteAso(aso),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asos"] });
      toast.success("ASO excluído.");
      setParaExcluir(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const rows = data?.rows ?? [];

  const cards = useMemo(
    () => [
      { label: "Total de ASOs", value: resumo?.total ?? 0 },
      { label: "Vencidos", value: resumo?.vencidos ?? 0, alerta: true },
      { label: "A vencer em 30 dias", value: resumo?.aVencer30 ?? 0 },
      { label: "Inaptos", value: resumo?.inaptos ?? 0, alerta: true },
    ],
    [resumo],
  );

  async function abrirAnexo(path: string) {
    try {
      const url = await getUrlDocumentoSst(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível abrir o documento.");
    }
  }

  function resetPagina<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  return (
    <PageShell
      title="ASO"
      description="Atestados de Saúde Ocupacional: exames, resultados e controle de vencimentos."
      icon={<HeartPulse className="h-5 w-5 text-gold-foreground" />}
      actions={
        canManageSst ? (
          <Button
            className="bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
            onClick={() => {
              setRegistro(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Novo ASO
          </Button>
        ) : undefined
      }
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p
                className={`mt-1 text-2xl font-semibold ${
                  c.alerta && c.value > 0 ? "text-destructive" : "text-foreground"
                }`}
              >
                {c.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por colaborador, CPF, matrícula, clínica ou médico"
            aria-label="Buscar ASOs"
            value={search}
            onChange={(e) => resetPagina(setSearch)(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Select value={tipoExame} onValueChange={resetPagina((v) => setTipoExame(v as TipoExameAso | "todos"))}>
            <SelectTrigger aria-label="Tipo de exame">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {TIPO_EXAME_ORDER.map((t) => (
                <SelectItem key={t} value={t}>
                  {TIPO_EXAME_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={resultado} onValueChange={resetPagina((v) => setResultado(v as ResultadoAso | "todos"))}>
            <SelectTrigger aria-label="Resultado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os resultados</SelectItem>
              {RESULTADO_ORDER.map((r) => (
                <SelectItem key={r} value={r}>
                  {RESULTADO_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={situacao} onValueChange={resetPagina((v) => setSituacao(v as SituacaoAso | "todos"))}>
            <SelectTrigger aria-label="Situação">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as situações</SelectItem>
              <SelectItem value="vigente">Vigente</SelectItem>
              <SelectItem value="a_vencer">A vencer</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="sem_vencimento">Sem vencimento</SelectItem>
            </SelectContent>
          </Select>
          <Select value={unidade} onValueChange={resetPagina(setUnidade)}>
            <SelectTrigger aria-label="Unidade">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as unidades</SelectItem>
              {(resumo?.unidades ?? []).map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          {isError ? (
            <div className="p-10 text-center">
              <p className="text-sm text-destructive">
                {error instanceof Error ? error.message : "Erro ao carregar os ASOs."}
              </p>
              <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Exame</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        Carregando ASOs...
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        Nenhum ASO encontrado com os filtros atuais.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <p className="font-medium text-foreground">
                            {a.colaborador?.nome_completo ?? "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {a.cargo || a.colaborador?.cargo || "Cargo não informado"}
                            {a.unidade ? ` • ${a.unidade}` : ""}
                          </p>
                        </TableCell>
                        <TableCell>{TIPO_EXAME_LABELS[a.tipo_exame]}</TableCell>
                        <TableCell>{formatarData(a.data_exame)}</TableCell>
                        <TableCell>{formatarData(a.data_vencimento)}</TableCell>
                        <TableCell>{a.resultado ? RESULTADO_LABELS[a.resultado] : "—"}</TableCell>
                        <TableCell>{situacaoBadge(situacaoAso(a.data_vencimento))}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" aria-label="Ações do ASO">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {a.arquivo_path && (
                                <DropdownMenuItem onClick={() => abrirAnexo(a.arquivo_path!)}>
                                  <Download className="mr-2 h-4 w-4" /> Ver documento
                                </DropdownMenuItem>
                              )}
                              {canManageSst && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setRegistro(a);
                                    setFormOpen(true);
                                  }}
                                >
                                  <Pencil className="mr-2 h-4 w-4" /> Editar
                                </DropdownMenuItem>
                              )}
                              {canDelete && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setParaExcluir(a)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {!isLoading && !isError && (data?.total ?? 0) > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            {data?.total} registro(s) • Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      <AsoFormSheet open={formOpen} onOpenChange={setFormOpen} registro={registro} />

      <Dialog open={!!paraExcluir} onOpenChange={(o) => !o && setParaExcluir(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir ASO?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação é irreversível e também remove o documento anexado.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setParaExcluir(null)}>
              Cancelar
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMut.isPending}
              onClick={() => paraExcluir && deleteMut.mutate(paraExcluir)}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
