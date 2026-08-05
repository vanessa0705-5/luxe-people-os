import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarClock,
  CalendarDays,
  Check,
  MoreHorizontal,
  Palmtree,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FeriasFormSheet } from "@/components/ferias/ferias-form-sheet";
import { ImportacaoDialog } from "@/components/importacao/importacao-dialog";
import { Upload } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getColaboradoresResumo } from "@/lib/colaboradores-api";
import {
  STATUS_FERIAS_LABELS,
  STATUS_FERIAS_ORDER,
  decidirFerias,
  deleteFerias,
  formatarData,
  getFeriasResumo,
  listFeriasPaged,
  type FeriasComColaborador,
  type StatusFerias,
} from "@/lib/ferias-api";

export const Route = createFileRoute("/_app/ferias")({
  head: () => ({
    meta: [
      { title: "Férias — Harmony HR Suite" },
      {
        name: "description",
        content:
          "Controle de férias dos colaboradores: solicitações, aprovações, períodos aquisitivos e programação anual.",
      },
      { property: "og:title", content: "Férias — Harmony HR Suite" },
      {
        property: "og:description",
        content: "Solicitações, aprovações e programação de férias dos colaboradores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FeriasPage,
});

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<StatusFerias, string> = {
  solicitada: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  aprovada: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  em_gozo: "border-sky-500/40 bg-sky-500/10 text-sky-500",
  concluida: "border-border bg-muted text-muted-foreground",
  reprovada: "border-destructive/40 bg-destructive/10 text-destructive",
  cancelada: "border-border bg-muted text-muted-foreground",
};

function StatusBadge({ status }: { status: StatusFerias }) {
  return (
    <Badge variant="outline" className={`text-[11px] font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_FERIAS_LABELS[status]}
    </Badge>
  );
}

function FeriasPage() {
  const queryClient = useQueryClient();
  const { hasRole, isAdminPrincipal, canDelete } = useAuth();
  const podeGerenciar = isAdminPrincipal || hasRole("rh");
  const podeSolicitar = podeGerenciar || hasRole("gestor");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFerias | "todos">("todos");
  const [departamento, setDepartamento] = useState<string>("todos");
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editando, setEditando] = useState<FeriasComColaborador | null>(null);
  const [paraExcluir, setParaExcluir] = useState<FeriasComColaborador | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const listQuery = useQuery({
    queryKey: ["ferias", "lista", { search, status, departamento, page }],
    queryFn: () =>
      listFeriasPaged({ search, status, departamento, page, pageSize: PAGE_SIZE }),
  });

  const resumoQuery = useQuery({ queryKey: ["ferias", "resumo"], queryFn: getFeriasResumo });
  const colabResumoQuery = useQuery({
    queryKey: ["colaboradores", "resumo"],
    queryFn: getColaboradoresResumo,
  });

  const decisaoMutation = useMutation({
    mutationFn: ({ id, decisao }: { id: string; decisao: "aprovada" | "reprovada" }) =>
      decidirFerias(id, decisao),
    onSuccess: (_d, vars) => {
      toast.success(vars.decisao === "aprovada" ? "Férias aprovadas." : "Férias reprovadas.");
      queryClient.invalidateQueries({ queryKey: ["ferias"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar a situação."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFerias(id),
    onSuccess: () => {
      toast.success("Registro de férias excluído.");
      setParaExcluir(null);
      queryClient.invalidateQueries({ queryKey: ["ferias"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir o registro."),
  });

  const rows = listQuery.data?.rows ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const inicioIntervalo = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const fimIntervalo = Math.min(page * PAGE_SIZE, total);

  const temFiltro = useMemo(
    () => !!search || status !== "todos" || departamento !== "todos",
    [search, status, departamento],
  );

  function limparFiltros() {
    setSearchInput("");
    setSearch("");
    setStatus("todos");
    setDepartamento("todos");
    setPage(1);
  }

  const cards = [
    {
      label: "Total de registros",
      value: resumoQuery.data?.total,
      icon: <CalendarDays className="h-4 w-4 text-gold" />,
    },
    {
      label: "Solicitações pendentes",
      value: resumoQuery.data?.solicitadas,
      icon: <CalendarClock className="h-4 w-4 text-gold" />,
    },
    {
      label: "Em gozo",
      value: resumoQuery.data?.emGozo,
      icon: <Palmtree className="h-4 w-4 text-gold" />,
    },
    {
      label: "Iniciam em 30 dias",
      value: resumoQuery.data?.proximas30,
      icon: <CalendarClock className="h-4 w-4 text-gold" />,
    },
  ];

  const [importOpen, setImportOpen] = useState(false);

  return (
    <PageShell
      title="Férias"
      description="Solicitações, aprovações e programação de férias dos colaboradores."
      icon={<Palmtree className="h-5 w-5 text-gold-foreground" />}
      actions={
        <>
          {podeSolicitar && (
            <Button variant="outline" className="border-border" onClick={() => setImportOpen(true)}>
              <Upload className="mr-1 h-4 w-4" aria-hidden="true" /> Importar
            </Button>
          )}
          {podeSolicitar ? (
          <Button
            onClick={() => {
              setEditando(null);
              setSheetOpen(true);
            }}
            className="bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
          >
            <Plus className="mr-1 h-4 w-4" /> Nova solicitação
          </Button>
        ) : undefined}
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <section
          aria-label="Resumo de férias"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {cards.map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-border bg-card p-4 shadow-elegant"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</p>
                {c.icon}
              </div>
              {resumoQuery.isLoading ? (
                <Skeleton className="mt-3 h-7 w-16" />
              ) : (
                <p className="mt-2 text-2xl font-semibold text-foreground">{c.value ?? 0}</p>
              )}
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-border bg-card p-4 shadow-elegant">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="busca">Buscar</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="busca"
                  className="pl-9"
                  placeholder="Nome, e-mail, CPF ou matrícula"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="filtro-dep">Departamento</Label>
              <Select
                value={departamento}
                onValueChange={(v) => {
                  setDepartamento(v);
                  setPage(1);
                }}
              >
                <SelectTrigger id="filtro-dep">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {(colabResumoQuery.data?.departamentos ?? []).map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="filtro-status">Situação</Label>
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v as StatusFerias | "todos");
                  setPage(1);
                }}
              >
                <SelectTrigger id="filtro-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {STATUS_FERIAS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_FERIAS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {temFiltro && (
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card shadow-elegant">
          {listQuery.isError ? (
            <div className="p-10 text-center">
              <p className="text-sm text-destructive">
                Não foi possível carregar os registros de férias.
              </p>
              <Button variant="outline" className="mt-4" onClick={() => listQuery.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : listQuery.isLoading ? (
            <div className="flex flex-col gap-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center">
              <h3 className="text-base font-medium text-foreground">
                Nenhum registro de férias encontrado
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {temFiltro
                  ? "Ajuste a busca ou os filtros aplicados."
                  : "Registre a primeira solicitação de férias para começar."}
              </p>
              {temFiltro ? (
                <Button variant="outline" className="mt-4" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              ) : podeSolicitar ? (
                <Button
                  className="mt-4 bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
                  onClick={() => {
                    setEditando(null);
                    setSheetOpen(true);
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" /> Nova solicitação
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-center">Dias</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead className="w-12 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <p className="font-medium text-foreground">
                            {r.colaborador?.nome_completo ?? "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {r.colaborador?.cargo ?? "Cargo não informado"}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.colaborador?.departamento ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatarData(r.data_inicio)} a {formatarData(r.data_fim)}
                        </TableCell>
                        <TableCell className="text-center text-sm">{r.dias}</TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <AcoesMenu
                            registro={r}
                            podeGerenciar={podeGerenciar}
                            canDelete={canDelete}
                            onEditar={() => {
                              setEditando(r);
                              setSheetOpen(true);
                            }}
                            onDecidir={(decisao) =>
                              decisaoMutation.mutate({ id: r.id, decisao })
                            }
                            onExcluir={() => setParaExcluir(r)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="flex flex-col divide-y divide-border md:hidden">
                {rows.map((r) => (
                  <article key={r.id} className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {r.colaborador?.nome_completo ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.colaborador?.departamento ?? "Sem departamento"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatarData(r.data_inicio)} a {formatarData(r.data_fim)} · {r.dias} dias
                      </p>
                      <div className="mt-2">
                        <StatusBadge status={r.status} />
                      </div>
                    </div>
                    <AcoesMenu
                      registro={r}
                      podeGerenciar={podeGerenciar}
                      canDelete={canDelete}
                      onEditar={() => {
                        setEditando(r);
                        setSheetOpen(true);
                      }}
                      onDecidir={(decisao) => decisaoMutation.mutate({ id: r.id, decisao })}
                      onExcluir={() => setParaExcluir(r)}
                    />
                  </article>
                ))}
              </div>

              <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
                <p className="text-xs text-muted-foreground">
                  Exibindo {inicioIntervalo}–{fimIntervalo} de {total} registro(s)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>

        {!canDelete && (
          <p className="text-center text-xs text-muted-foreground">
            Somente o Administrador Principal pode excluir registros neste módulo.
          </p>
        )}
      </div>

      <FeriasFormSheet open={sheetOpen} onOpenChange={setSheetOpen} registro={editando} />
      <ImportacaoDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        modulo="ferias"
        invalidateKeys={["ferias", "colaboradores"]}
      />

      <AlertDialog open={!!paraExcluir} onOpenChange={(o) => !o && setParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro de férias?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e removerá o período de{" "}
              {paraExcluir?.colaborador?.nome_completo ?? "colaborador"} (
              {formatarData(paraExcluir?.data_inicio ?? null)} a{" "}
              {formatarData(paraExcluir?.data_fim ?? null)}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => paraExcluir && deleteMutation.mutate(paraExcluir.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

interface AcoesProps {
  registro: FeriasComColaborador;
  podeGerenciar: boolean;
  canDelete: boolean;
  onEditar: () => void;
  onDecidir: (decisao: "aprovada" | "reprovada") => void;
  onExcluir: () => void;
}

function AcoesMenu({
  registro,
  podeGerenciar,
  canDelete,
  onEditar,
  onDecidir,
  onExcluir,
}: AcoesProps) {
  if (!podeGerenciar && !canDelete) {
    return null;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Ações do registro">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {podeGerenciar && (
          <DropdownMenuItem onClick={onEditar}>
            <Pencil className="mr-2 h-4 w-4" /> Editar
          </DropdownMenuItem>
        )}
        {podeGerenciar && registro.status === "solicitada" && (
          <>
            <DropdownMenuItem onClick={() => onDecidir("aprovada")}>
              <Check className="mr-2 h-4 w-4" /> Aprovar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDecidir("reprovada")}>
              <X className="mr-2 h-4 w-4" /> Reprovar
            </DropdownMenuItem>
          </>
        )}
        {canDelete && (
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onExcluir}>
            <Trash2 className="mr-2 h-4 w-4" /> Excluir
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
