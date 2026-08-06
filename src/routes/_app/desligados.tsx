import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarX,
  Download,
  Eye,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Timer,
  TrendingDown,
  UserMinus,
  Users,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { listColaboradores, listTomadores } from "@/lib/colaboradores-api";
import { formatarData } from "@/lib/movimentacoes-api";
import {
  desligadosParaCsv,
  getDesligadosResumo,
  listDesligadosPaged,
  permanenciaTexto,
  readmitirColaborador,
  registrarDesligamento,
  type DesligadoComMotivo,
} from "@/lib/desligados-api";

export const Route = createFileRoute("/_app/desligados")({
  head: () => ({
    meta: [
      { title: "Desligados — Harmony HR Suite" },
      {
        name: "description",
        content:
          "Controle de desligamentos e rescisões: motivos, datas, tempo de permanência e readmissões.",
      },
      { property: "og:title", content: "Desligados — Harmony HR Suite" },
      {
        property: "og:description",
        content: "Histórico de desligamentos, motivos de rescisão e tempo de casa por colaborador.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DesligadosPage,
});

const PAGE_SIZE = 10;
const HOJE = () => new Date().toISOString().slice(0, 10);

const MOTIVOS = [
  "Pedido de demissão",
  "Dispensa sem justa causa",
  "Dispensa por justa causa",
  "Término de contrato",
  "Acordo entre as partes",
  "Aposentadoria",
  "Falecimento",
  "Outro",
];

function ResumoCard({
  label,
  valor,
  icon,
  loading,
}: {
  label: string;
  valor: string | number;
  icon: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-elegant">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-16" />
      ) : (
        <p className="mt-2 text-2xl font-semibold text-foreground">{valor}</p>
      )}
    </div>
  );
}

function DesligadosPage() {
  const queryClient = useQueryClient();
  const { hasRole, isAdminPrincipal } = useAuth();
  const podeGerenciar = isAdminPrincipal || hasRole("rh");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [departamento, setDepartamento] = useState("todos");
  const [tomadorId, setTomadorId] = useState("todos");
  const [ano, setAno] = useState("todos");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detalhe, setDetalhe] = useState<DesligadoComMotivo | null>(null);
  const [paraReadmitir, setParaReadmitir] = useState<DesligadoComMotivo | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const listQuery = useQuery({
    queryKey: ["desligados", "lista", { search, departamento, tomadorId, ano, page }],
    queryFn: () =>
      listDesligadosPaged({ search, departamento, tomadorId, ano, page, pageSize: PAGE_SIZE }),
  });

  const resumoQuery = useQuery({ queryKey: ["desligados", "resumo"], queryFn: getDesligadosResumo });

  const tomadoresQuery = useQuery({ queryKey: ["tomadores", "select"], queryFn: listTomadores });

  const colaboradoresQuery = useQuery({
    queryKey: ["colaboradores", "para-desligar"],
    queryFn: () => listColaboradores(),
  });

  const departamentos = useMemo(() => {
    const set = new Set(
      (colaboradoresQuery.data ?? []).map((c) => c.departamento).filter(Boolean) as string[],
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [colaboradoresQuery.data]);

  const ativos = useMemo(
    () => (colaboradoresQuery.data ?? []).filter((c) => c.status !== "desligado"),
    [colaboradoresQuery.data],
  );

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["desligados"] });
    queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
    queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
  };

  const readmitirMutation = useMutation({
    mutationFn: (registro: DesligadoComMotivo) => readmitirColaborador(registro.id, HOJE()),
    onSuccess: () => {
      toast.success("Colaborador readmitido e reativado no cadastro.");
      setParaReadmitir(null);
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível readmitir o colaborador."),
  });

  const rows = listQuery.data?.rows ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function exportar() {
    if (rows.length === 0) {
      toast.error("Nenhum registro para exportar.");
      return;
    }
    const csv = desligadosParaCsv(rows);
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `desligados-${HOJE()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageShell
      title="Desligados"
      description="Controle de desligamentos e rescisões, com motivos, datas e tempo de permanência."
      icon={<UserMinus className="h-5 w-5 text-gold-foreground" />}
      actions={
        <>
          <Button variant="outline" className="border-border" onClick={exportar}>
            <Download className="mr-1 h-4 w-4" /> Exportar
          </Button>
          {podeGerenciar && (
            <Button
              className="bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="mr-1 h-4 w-4" /> Registrar desligamento
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ResumoCard
            label="Total de desligados"
            valor={resumoQuery.data?.total ?? 0}
            icon={<Users className="h-4 w-4" />}
            loading={resumoQuery.isLoading}
          />
          <ResumoCard
            label="No mês"
            valor={resumoQuery.data?.mes ?? 0}
            icon={<CalendarX className="h-4 w-4" />}
            loading={resumoQuery.isLoading}
          />
          <ResumoCard
            label="No ano"
            valor={resumoQuery.data?.ano ?? 0}
            icon={<TrendingDown className="h-4 w-4" />}
            loading={resumoQuery.isLoading}
          />
          <ResumoCard
            label="Permanência média"
            valor={`${resumoQuery.data?.permanenciaMediaMeses ?? 0} meses`}
            icon={<Timer className="h-4 w-4" />}
            loading={resumoQuery.isLoading}
          />
        </div>

        <div className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-elegant md:grid-cols-4">
          <div className="md:col-span-2">
            <Label htmlFor="busca-desligados" className="text-xs text-muted-foreground">
              Buscar
            </Label>
            <div className="relative mt-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="busca-desligados"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Nome, e-mail, CPF ou matrícula"
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Departamento</Label>
            <Select
              value={departamento}
              onValueChange={(v) => {
                setDepartamento(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="mt-1" aria-label="Filtrar por departamento">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {departamentos.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Ano</Label>
            <Select
              value={ano}
              onValueChange={(v) => {
                setAno(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="mt-1" aria-label="Filtrar por ano do desligamento">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(resumoQuery.data?.anos ?? []).map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs text-muted-foreground">Tomador</Label>
            <Select
              value={tomadorId}
              onValueChange={(v) => {
                setTomadorId(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="mt-1" aria-label="Filtrar por tomador">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(tomadoresQuery.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {listQuery.isError ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-center">
            <p className="text-sm text-destructive">
              Não foi possível carregar os desligamentos.{" "}
              {(listQuery.error as Error)?.message ?? ""}
            </p>
            <Button variant="outline" className="mt-3" onClick={() => listQuery.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : listQuery.isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center shadow-elegant">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent">
              <UserMinus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium text-foreground">Nenhum desligamento</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Não encontramos registros com os filtros atuais.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-elegant md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Cargo / Departamento</TableHead>
                    <TableHead>Admissão</TableHead>
                    <TableHead>Desligamento</TableHead>
                    <TableHead>Permanência</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">{r.nome_completo}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.matricula ? `Matrícula ${r.matricula}` : r.cpf}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{r.cargo ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.departamento ?? "—"}</div>
                      </TableCell>
                      <TableCell className="text-sm">{formatarData(r.data_admissao)}</TableCell>
                      <TableCell className="text-sm">{formatarData(r.data_desligamento)}</TableCell>
                      <TableCell className="text-sm">
                        {permanenciaTexto(r.data_admissao, r.data_desligamento)}
                      </TableCell>
                      <TableCell>
                        {r.desligamento?.motivo ? (
                          <Badge
                            variant="outline"
                            className="border-destructive/40 bg-destructive/10 text-[11px] text-destructive"
                          >
                            {r.desligamento.motivo}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Não informado</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Ações para ${r.nome_completo}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetalhe(r)}>
                              <Eye className="mr-2 h-4 w-4" /> Ver detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to="/colaboradores/$id" params={{ id: r.id }}>
                                <Users className="mr-2 h-4 w-4" /> Abrir ficha
                              </Link>
                            </DropdownMenuItem>
                            {podeGerenciar && (
                              <DropdownMenuItem onClick={() => setParaReadmitir(r)}>
                                <RotateCcw className="mr-2 h-4 w-4" /> Readmitir
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 md:hidden">
              {rows.map((r) => (
                <div key={r.id} className="rounded-xl border border-border bg-card p-4 shadow-elegant">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{r.nome_completo}</p>
                      <p className="text-xs text-muted-foreground">{r.cargo ?? "—"}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDetalhe(r)}
                      aria-label={`Ver detalhes de ${r.nome_completo}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Admissão</dt>
                      <dd>{formatarData(r.data_admissao)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Desligamento</dt>
                      <dd>{formatarData(r.data_desligamento)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Permanência</dt>
                      <dd>{permanenciaTexto(r.data_admissao, r.data_desligamento)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Motivo</dt>
                      <dd>{r.desligamento?.motivo ?? "Não informado"}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {total} registro(s) · página {page} de {totalPaginas}
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
                  disabled={page >= totalPaginas}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </>
        )}

        {!podeGerenciar && (
          <p className="text-center text-xs text-muted-foreground">
            Seu perfil permite apenas consulta neste módulo.
          </p>
        )}
      </div>

      <DesligamentoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        colaboradores={ativos.map((c) => ({
          id: c.id,
          nome: c.nome_completo,
          matricula: c.matricula,
        }))}
        onSalvo={invalidar}
      />

      <Dialog open={!!detalhe} onOpenChange={(v) => !v && setDetalhe(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detalhe?.nome_completo}</DialogTitle>
            <DialogDescription>Detalhes do desligamento</DialogDescription>
          </DialogHeader>
          {detalhe && (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">CPF</dt>
                <dd>{detalhe.cpf}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Matrícula</dt>
                <dd>{detalhe.matricula ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Cargo</dt>
                <dd>{detalhe.cargo ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Departamento</dt>
                <dd>{detalhe.departamento ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Tomador</dt>
                <dd>{detalhe.tomador?.razao_social ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Permanência</dt>
                <dd>{permanenciaTexto(detalhe.data_admissao, detalhe.data_desligamento)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Admissão</dt>
                <dd>{formatarData(detalhe.data_admissao)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Desligamento</dt>
                <dd>{formatarData(detalhe.data_desligamento)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Motivo</dt>
                <dd>{detalhe.desligamento?.motivo ?? "Não informado"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Observações</dt>
                <dd>{detalhe.desligamento?.observacoes ?? "—"}</dd>
              </div>
            </dl>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetalhe(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!paraReadmitir} onOpenChange={(v) => !v && setParaReadmitir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Readmitir colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              {paraReadmitir?.nome_completo} voltará à situação “Ativo” e uma movimentação de
              admissão será registrada com a data de hoje.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => paraReadmitir && readmitirMutation.mutate(paraReadmitir)}
              disabled={readmitirMutation.isPending}
            >
              Readmitir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

function DesligamentoDialog({
  open,
  onOpenChange,
  colaboradores,
  onSalvo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  colaboradores: { id: string; nome: string; matricula: string | null }[];
  onSalvo: () => void;
}) {
  const [colaboradorId, setColaboradorId] = useState("");
  const [dataEfeito, setDataEfeito] = useState(HOJE());
  const [motivo, setMotivo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setColaboradorId("");
      setDataEfeito(HOJE());
      setMotivo("");
      setObservacoes("");
      setErros({});
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => registrarDesligamento({ colaboradorId, dataEfeito, motivo, observacoes }),
    onSuccess: () => {
      toast.success("Desligamento registrado com sucesso.");
      onSalvo();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível registrar o desligamento."),
  });

  function salvar() {
    const e: Record<string, string> = {};
    if (!colaboradorId) e.colaboradorId = "Selecione o colaborador.";
    if (!dataEfeito) e.dataEfeito = "Informe a data do desligamento.";
    if (!motivo) e.motivo = "Selecione o motivo.";
    setErros(e);
    if (Object.keys(e).length === 0) mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar desligamento</DialogTitle>
          <DialogDescription>
            O cadastro do colaborador é atualizado automaticamente para “Desligado”.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="colab-desligamento">Colaborador *</Label>
            <Select value={colaboradorId} onValueChange={setColaboradorId}>
              <SelectTrigger id="colab-desligamento" className="mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {colaboradores.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                    {c.matricula ? ` · ${c.matricula}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {erros.colaboradorId && (
              <p className="mt-1 text-xs text-destructive">{erros.colaboradorId}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="data-desligamento">Data do desligamento *</Label>
              <Input
                id="data-desligamento"
                type="date"
                className="mt-1"
                value={dataEfeito}
                onChange={(e) => setDataEfeito(e.target.value)}
              />
              {erros.dataEfeito && (
                <p className="mt-1 text-xs text-destructive">{erros.dataEfeito}</p>
              )}
            </div>
            <div>
              <Label htmlFor="motivo-desligamento">Motivo *</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger id="motivo-desligamento" className="mt-1">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {erros.motivo && <p className="mt-1 text-xs text-destructive">{erros.motivo}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="obs-desligamento">Observações</Label>
            <Textarea
              id="obs-desligamento"
              className="mt-1"
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Detalhes da rescisão, aviso prévio, pendências..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
            onClick={salvar}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Salvando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
