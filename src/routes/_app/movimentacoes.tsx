import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUpRight,
  CalendarDays,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat,
  Search,
  Trash2,
  UserMinus,
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
import { MovimentacaoFormSheet } from "@/components/movimentacoes/movimentacao-form-sheet";
import { useAuth } from "@/lib/auth-context";
import { getColaboradoresResumo } from "@/lib/colaboradores-api";
import {
  TIPO_MOV_LABELS,
  TIPO_MOV_ORDER,
  deleteMovimentacao,
  formatarData,
  getMovimentacoesResumo,
  listMovimentacoesPaged,
  resumirMudanca,
  type MovimentacaoComColaborador,
  type TipoMovimentacao,
} from "@/lib/movimentacoes-api";

export const Route = createFileRoute("/_app/movimentacoes")({
  head: () => ({
    meta: [
      { title: "Movimentações — Harmony HR Suite" },
      {
        name: "description",
        content:
          "Histórico funcional dos colaboradores: promoções, alterações salariais, transferências, afastamentos, admissões e desligamentos.",
      },
      { property: "og:title", content: "Movimentações — Harmony HR Suite" },
      {
        property: "og:description",
        content: "Promoções, transferências, afastamentos e desligamentos dos colaboradores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MovimentacoesPage,
});

const PAGE_SIZE = 10;

const TIPO_STYLES: Record<TipoMovimentacao, string> = {
  admissao: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  promocao: "border-gold/40 bg-gold/10 text-gold",
  alteracao_salarial: "border-sky-500/40 bg-sky-500/10 text-sky-500",
  transferencia: "border-indigo-500/40 bg-indigo-500/10 text-indigo-400",
  afastamento: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  retorno: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  desligamento: "border-destructive/40 bg-destructive/10 text-destructive",
};

function TipoBadge({ tipo }: { tipo: TipoMovimentacao }) {
  return (
    <Badge variant="outline" className={`text-[11px] font-medium ${TIPO_STYLES[tipo]}`}>
      {TIPO_MOV_LABELS[tipo]}
    </Badge>
  );
}

function MovimentacoesPage() {
  const queryClient = useQueryClient();
  const { hasRole, isAdminPrincipal, canDelete } = useAuth();
  const podeGerenciar = isAdminPrincipal || hasRole("rh");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState<TipoMovimentacao | "todos">("todos");
  const [departamento, setDepartamento] = useState<string>("todos");
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editando, setEditando] = useState<MovimentacaoComColaborador | null>(null);
  const [paraExcluir, setParaExcluir] = useState<MovimentacaoComColaborador | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const listQuery = useQuery({
    queryKey: ["movimentacoes", "lista", { search, tipo, departamento, page }],
    queryFn: () =>
      listMovimentacoesPaged({ search, tipo, departamento, page, pageSize: PAGE_SIZE }),
  });

  const resumoQuery = useQuery({
    queryKey: ["movimentacoes", "resumo"],
    queryFn: getMovimentacoesResumo,
  });

  const colabResumoQuery = useQuery({
    queryKey: ["colaboradores", "resumo"],
    queryFn: getColaboradoresResumo,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMovimentacao(id),
    onSuccess: () => {
      toast.success("Movimentação excluída.");
      setParaExcluir(null);
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
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
    () => !!search || tipo !== "todos" || departamento !== "todos",
    [search, tipo, departamento],
  );

  function limparFiltros() {
    setSearchInput("");
    setSearch("");
    setTipo("todos");
    setDepartamento("todos");
    setPage(1);
  }

  const cards = [
    {
      label: "Total de movimentações",
      value: resumoQuery.data?.total,
      icon: <Repeat className="h-4 w-4 text-gold" />,
    },
    {
      label: "No mês atual",
      value: resumoQuery.data?.mes,
      icon: <CalendarDays className="h-4 w-4 text-gold" />,
    },
    {
      label: "Promoções",
      value: resumoQuery.data?.promocoes,
      icon: <ArrowUpRight className="h-4 w-4 text-gold" />,
    },
    {
      label: "Desligamentos",
      value: resumoQuery.data?.desligamentos,
      icon: <UserMinus className="h-4 w-4 text-gold" />,
    },
  ];

  return (
    <PageShell
      title="Movimentações"
      description="Promoções, alterações salariais, transferências, afastamentos, admissões e desligamentos."
      icon={<Repeat className="h-5 w-5 text-gold-foreground" />}
      actions={
        podeGerenciar ? (
          <Button
            onClick={() => {
              setEditando(null);
              setSheetOpen(true);
            }}
            className="bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
          >
            <Plus className="mr-1 h-4 w-4" /> Nova movimentação
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-6">
        <section
          aria-label="Resumo de movimentações"
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
              <Label htmlFor="busca-mov">Buscar</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="busca-mov"
                  className="pl-9"
                  placeholder="Nome, e-mail, CPF ou matrícula"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="filtro-dep-mov">Departamento</Label>
              <Select
                value={departamento}
                onValueChange={(v) => {
                  setDepartamento(v);
                  setPage(1);
                }}
              >
                <SelectTrigger id="filtro-dep-mov">
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
              <Label htmlFor="filtro-tipo-mov">Tipo</Label>
              <Select
                value={tipo}
                onValueChange={(v) => {
                  setTipo(v as TipoMovimentacao | "todos");
                  setPage(1);
                }}
              >
                <SelectTrigger id="filtro-tipo-mov">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {TIPO_MOV_ORDER.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_MOV_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {temFiltro && (
            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card shadow-elegant">
          {listQuery.isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : listQuery.isError ? (
            <div className="p-10 text-center">
              <p className="text-sm text-destructive">
                Não foi possível carregar as movimentações.
              </p>
              <Button variant="outline" className="mt-4" onClick={() => listQuery.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-muted-foreground">
                {temFiltro
                  ? "Nenhuma movimentação encontrada com os filtros aplicados."
                  : "Nenhuma movimentação registrada até o momento."}
              </p>
              {temFiltro ? (
                <Button variant="outline" className="mt-4" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              ) : (
                podeGerenciar && (
                  <Button
                    className="mt-4 bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
                    onClick={() => {
                      setEditando(null);
                      setSheetOpen(true);
                    }}
                  >
                    <Plus className="mr-1 h-4 w-4" /> Nova movimentação
                  </Button>
                )
              )}
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Data de efeito</TableHead>
                      <TableHead>Alteração</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <p className="text-sm font-medium text-foreground">
                            {m.colaborador?.nome_completo ?? "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {m.colaborador?.matricula ?? m.colaborador?.cpf ?? ""}
                          </p>
                        </TableCell>
                        <TableCell>
                          <TipoBadge tipo={m.tipo} />
                        </TableCell>
                        <TableCell className="text-sm">{formatarData(m.data_efeito)}</TableCell>
                        <TableCell className="max-w-[320px] text-xs text-muted-foreground">
                          {resumirMudanca(m)}
                          {m.motivo && <span className="block">Motivo: {m.motivo}</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <AcoesMenu
                            registro={m}
                            podeGerenciar={podeGerenciar}
                            canDelete={canDelete}
                            onEditar={() => {
                              setEditando(m);
                              setSheetOpen(true);
                            }}
                            onExcluir={() => setParaExcluir(m)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="flex flex-col divide-y divide-border md:hidden">
                {rows.map((m) => (
                  <article key={m.id} className="flex flex-col gap-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {m.colaborador?.nome_completo ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatarData(m.data_efeito)}
                        </p>
                      </div>
                      <AcoesMenu
                        registro={m}
                        podeGerenciar={podeGerenciar}
                        canDelete={canDelete}
                        onEditar={() => {
                          setEditando(m);
                          setSheetOpen(true);
                        }}
                        onExcluir={() => setParaExcluir(m)}
                      />
                    </div>
                    <TipoBadge tipo={m.tipo} />
                    <p className="text-xs text-muted-foreground">{resumirMudanca(m)}</p>
                    {m.motivo && (
                      <p className="text-xs text-muted-foreground">Motivo: {m.motivo}</p>
                    )}
                  </article>
                ))}
              </div>

              <div className="flex flex-col items-center justify-between gap-3 border-t border-border p-4 sm:flex-row">
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

      <MovimentacaoFormSheet
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) setEditando(null);
        }}
        registro={editando}
      />

      <AlertDialog open={!!paraExcluir} onOpenChange={(o) => !o && setParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir movimentação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O histórico de{" "}
              {paraExcluir?.colaborador?.nome_completo ?? "colaborador"} será alterado, mas a ficha
              atual do colaborador permanece como está.
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

function AcoesMenu({
  registro,
  podeGerenciar,
  canDelete,
  onEditar,
  onExcluir,
}: {
  registro: MovimentacaoComColaborador;
  podeGerenciar: boolean;
  canDelete: boolean;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  if (!podeGerenciar && !canDelete) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Ações para a movimentação de ${registro.colaborador?.nome_completo ?? "colaborador"}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {podeGerenciar && (
          <DropdownMenuItem onClick={onEditar}>
            <Pencil className="mr-2 h-4 w-4" /> Editar
          </DropdownMenuItem>
        )}
        {canDelete && (
          <DropdownMenuItem className="text-destructive" onClick={onExcluir}>
            <Trash2 className="mr-2 h-4 w-4" /> Excluir
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
