import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  MoreHorizontal,
  UserCheck,
  Palmtree,
  Building2,
  AlertTriangle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  deleteColaborador,
  getColaboradoresResumo,
  listColaboradoresPaged,
  listTomadores,
  STATUS_LABELS,
  type Colaborador,
  type ColaboradorComTomador,
  type StatusColaborador,
} from "@/lib/colaboradores-api";
import { ColaboradorFormSheet } from "@/components/colaboradores/colaborador-form-sheet";
import { ImportacaoDialog } from "@/components/importacao/importacao-dialog";
import { Upload } from "lucide-react";

export const Route = createFileRoute("/_app/colaboradores")({
  head: () => ({
    meta: [
      { title: "Colaboradores — Harmony HR Suite" },
      {
        name: "description",
        content:
          "Gestão completa do quadro de colaboradores: cadastro, filtros, status e histórico.",
      },
      { property: "og:title", content: "Colaboradores — Harmony HR Suite" },
      {
        property: "og:description",
        content: "Cadastro, busca e gestão do quadro de colaboradores da empresa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ColaboradoresPage,
});

const statusVariant: Record<StatusColaborador, string> = {
  ativo: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  afastado: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  ferias: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  desligado: "bg-rose-500/15 text-rose-700 border-rose-500/30",
};

const PAGE_SIZE = 10;

function formatDate(value: string | null) {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return d ? `${d}/${m}/${y}` : value;
}

function initials(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function ColaboradoresPage() {
  const { hasRole, canDelete, isAdminPrincipal } = useAuth();
  const canManage = isAdminPrincipal || hasRole("rh");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<StatusColaborador | "todos">("todos");
  const [tomadorId, setTomadorId] = useState<string>("todos");
  const [departamento, setDepartamento] = useState<string>("todos");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Colaborador | null>(null);
  const [toDelete, setToDelete] = useState<Colaborador | null>(null);

  const qc = useQueryClient();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, tomadorId, departamento]);

  const filters = useMemo(
    () => ({ search: debouncedSearch, status, tomadorId, departamento, page, pageSize: PAGE_SIZE }),
    [debouncedSearch, status, tomadorId, departamento, page],
  );

  const listQuery = useQuery({
    queryKey: ["colaboradores", filters],
    queryFn: () => listColaboradoresPaged(filters),
  });

  const resumoQuery = useQuery({
    queryKey: ["colaboradores", "resumo"],
    queryFn: getColaboradoresResumo,
  });

  const { data: tomadores = [] } = useQuery({
    queryKey: ["tomadores", "ativos"],
    queryFn: listTomadores,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteColaborador(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["colaboradores"] });
      toast.success("Colaborador excluído com sucesso");
      setToDelete(null);
    },
    onError: (err: Error) => toast.error(err.message || "Não foi possível excluir o colaborador"),
  });

  const rows = listQuery.data?.rows ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const resumo = resumoQuery.data;

  const hasActiveFilters =
    Boolean(debouncedSearch) ||
    status !== "todos" ||
    tomadorId !== "todos" ||
    departamento !== "todos";

  function clearFilters() {
    setSearch("");
    setStatus("todos");
    setTomadorId("todos");
    setDepartamento("todos");
  }

  const cards = [
    {
      label: "Total de colaboradores",
      value: resumo?.total,
      icon: Users,
    },
    { label: "Ativos", value: resumo?.ativos, icon: UserCheck },
    { label: "Em férias", value: resumo?.ferias, icon: Palmtree },
    { label: "Departamentos", value: resumo?.departamentos.length, icon: Building2 },
  ];

  const [importOpen, setImportOpen] = useState(false);

  return (
    <PageShell
      title="Colaboradores"
      description="Cadastro, busca e gestão completa do quadro de colaboradores."
      icon={<Users className="h-5 w-5 text-gold-foreground" aria-hidden="true" />}
      actions={
        <>
          {canManage && (
            <Button variant="outline" className="border-border" onClick={() => setImportOpen(true)}>
              <Upload className="mr-1 h-4 w-4" aria-hidden="true" /> Importar
            </Button>
          )}
        canManage && (
          <Button
            className="w-full bg-gradient-gold font-semibold shadow-gold hover:opacity-95 md:w-auto"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Novo colaborador
          </Button>
        )
        </>
      }
    >
      {/* Cartões de resumo */}
      <section
        aria-label="Resumo do quadro de colaboradores"
        className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-border bg-card p-4 shadow-elegant"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
              <p className="min-w-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {c.label}
              </p>
              <c.icon className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
            </div>
            {resumoQuery.isLoading ? (
              <Skeleton className="mt-2 h-8 w-14" />
            ) : (
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                {c.value ?? 0}
              </p>
            )}
          </div>
        ))}
      </section>

      {/* Busca e filtros */}
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-elegant lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Buscar colaboradores"
            placeholder="Buscar por nome, e-mail, CPF ou matrícula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:flex">
          <Select value={departamento} onValueChange={setDepartamento}>
            <SelectTrigger className="lg:w-48" aria-label="Filtrar por departamento">
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os departamentos</SelectItem>
              {(resumo?.departamentos ?? []).map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tomadorId} onValueChange={setTomadorId}>
            <SelectTrigger className="lg:w-52" aria-label="Filtrar por tomador">
              <SelectValue placeholder="Tomador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tomadores</SelectItem>
              {tomadores.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.razao_social}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusColaborador | "todos")}>
            <SelectTrigger className="lg:w-40" aria-label="Filtrar por status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="afastado">Afastado</SelectItem>
              <SelectItem value="ferias">Em Férias</SelectItem>
              <SelectItem value="desligado">Desligado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters} className="lg:shrink-0">
            <RotateCcw className="mr-1 h-4 w-4" aria-hidden="true" /> Limpar
          </Button>
        )}
      </div>

      {/* Conteúdo */}
      {listQuery.isError ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center shadow-elegant"
        >
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" aria-hidden="true" />
          <h3 className="text-base font-medium text-foreground">
            Não foi possível carregar os colaboradores
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {(listQuery.error as Error)?.message ?? "Erro inesperado ao consultar o banco de dados."}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => listQuery.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <>
          {/* Tabela (desktop) */}
          <div className="hidden rounded-xl border border-border bg-card shadow-elegant md:block">
            <Table>
              <caption className="sr-only">
                Lista de colaboradores com cargo, departamento, status e data de admissão
              </caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Admissão</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center">
                      <EmptyState
                        hasFilters={hasActiveFilters}
                        canManage={canManage}
                        onClear={clearFilters}
                        onCreate={() => {
                          setEditing(null);
                          setFormOpen(true);
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            aria-hidden="true"
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-gold text-xs font-semibold text-gold-foreground"
                          >
                            {initials(c.nome_completo)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {c.nome_completo}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {c.email ?? c.matricula ?? c.cpf}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.cargo ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.departamento ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusVariant[c.status as StatusColaborador]}
                        >
                          {STATUS_LABELS[c.status as StatusColaborador]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {formatDate(c.data_admissao)}
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActions
                          colaborador={c}
                          canManage={canManage}
                          canDelete={canDelete}
                          onEdit={() => {
                            setEditing(c);
                            setFormOpen(true);
                          }}
                          onDelete={() => setToDelete(c)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Cartões (mobile) */}
          <div className="space-y-3 md:hidden">
            {listQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="mt-2 h-4 w-1/2" />
                </div>
              ))
            ) : rows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-8">
                <EmptyState
                  hasFilters={hasActiveFilters}
                  canManage={canManage}
                  onClear={clearFilters}
                  onCreate={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                />
              </div>
            ) : (
              rows.map((c) => (
                <article
                  key={c.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-elegant"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-medium text-foreground">{c.nome_completo}</h3>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.cargo ?? "Cargo não informado"}
                        {c.departamento ? ` · ${c.departamento}` : ""}
                      </p>
                    </div>
                    <RowActions
                      colaborador={c}
                      canManage={canManage}
                      canDelete={canDelete}
                      onEdit={() => {
                        setEditing(c);
                        setFormOpen(true);
                      }}
                      onDelete={() => setToDelete(c)}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={statusVariant[c.status as StatusColaborador]}
                    >
                      {STATUS_LABELS[c.status as StatusColaborador]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Admissão: {formatDate(c.data_admissao)}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>

          {/* Paginação */}
          {total > 0 && (
            <nav
              aria-label="Paginação de colaboradores"
              className="mt-4 grid grid-cols-1 items-center gap-3 sm:flex sm:justify-between"
            >
              <p className="text-xs text-muted-foreground" aria-live="polite">
                Exibindo {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}{" "}
                colaborador{total === 1 ? "" : "es"}
              </p>
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || listQuery.isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Anterior
                </Button>
                <span className="text-xs text-muted-foreground">
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || listQuery.isFetching}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Próxima <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </nav>
          )}
        </>
      )}

      {!canManage && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Seu perfil tem acesso somente de leitura neste módulo.
        </p>
      )}

      <ColaboradorFormSheet open={formOpen} onOpenChange={setFormOpen} colaborador={editing} />
      <ImportacaoDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        modulo="colaboradores"
        invalidateKeys={["colaboradores", "colaboradores"]}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O colaborador{" "}
              <strong>{toDelete?.nome_completo}</strong> será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

function RowActions({
  colaborador,
  canManage,
  canDelete,
  onEdit,
  onDelete,
}: {
  colaborador: ColaboradorComTomador;
  canManage: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Ações para ${colaborador.nome_completo}`}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs">Ações</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to="/colaboradores/$id" params={{ id: colaborador.id }}>
            <Eye className="mr-2 h-4 w-4" aria-hidden="true" /> Ver detalhes
          </Link>
        </DropdownMenuItem>
        {canManage && (
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" /> Editar
          </DropdownMenuItem>
        )}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={onDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> Excluir
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmptyState({
  hasFilters,
  canManage,
  onClear,
  onCreate,
}: {
  hasFilters: boolean;
  canManage: boolean;
  onClear: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="mx-auto max-w-sm text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-accent">
        <Users className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="text-base font-medium text-foreground">
        {hasFilters ? "Nenhum resultado encontrado" : "Nenhum colaborador cadastrado"}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasFilters
          ? "Ajuste a busca ou os filtros para encontrar colaboradores."
          : "Cadastre o primeiro colaborador para começar a usar o módulo."}
      </p>
      <div className="mt-4 flex justify-center gap-2">
        {hasFilters ? (
          <Button variant="outline" onClick={onClear}>
            Limpar filtros
          </Button>
        ) : (
          canManage && (
            <Button className="bg-gradient-gold font-semibold shadow-gold" onClick={onCreate}>
              <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Novo colaborador
            </Button>
          )
        )}
      </div>
    </div>
  );
}
