import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2,
  CheckCircle2,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  XCircle,
  Users,
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
import { useAuth } from "@/lib/auth-context";
import {
  STATUS_EMPRESA_LABELS,
  deleteEmpresa,
  getEmpresasResumo,
  listEmpresasPaged,
  type Empresa,
  type StatusEmpresa,
} from "@/lib/empresas-api";
import { EmpresaFormSheet } from "@/components/empresas/empresa-form-sheet";
import { ImportacaoDialog } from "@/components/importacao/importacao-dialog";
import { Upload } from "lucide-react";
import { EmpresaDetalhesSheet } from "@/components/empresas/empresa-detalhes-sheet";
import { maskCnpj, maskTelefone } from "@/lib/br-format";

export const Route = createFileRoute("/_app/empresas")({
  head: () => ({
    meta: [
      { title: "Empresas (CNPJs) — Harmony HR Suite" },
      {
        name: "description",
        content:
          "Cadastro e controle das empresas do grupo: CNPJs, endereços, contatos e tomadores vinculados.",
      },
      { property: "og:title", content: "Empresas (CNPJs) — Harmony HR Suite" },
      {
        property: "og:description",
        content: "Gestão completa das empresas e CNPJs do grupo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmpresasPage,
});

const PAGE_SIZE = 10;

function EmpresasPage() {
  const { canDelete, hasRole, isAdminPrincipal } = useAuth();
  const canManage = isAdminPrincipal || hasRole("rh");
  const qc = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusEmpresa | "todos">("todos");
  const [uf, setUf] = useState<string>("todos");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [selected, setSelected] = useState<Empresa | null>(null);
  const [toDelete, setToDelete] = useState<Empresa | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const resumo = useQuery({ queryKey: ["empresas-resumo"], queryFn: getEmpresasResumo });

  const lista = useQuery({
    queryKey: ["empresas", { search, status, uf, page }],
    queryFn: () => listEmpresasPaged({ search, status, uf, page, pageSize: PAGE_SIZE }),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteEmpresa(id),
    onSuccess: () => {
      toast.success("Empresa excluída com sucesso.");
      qc.invalidateQueries({ queryKey: ["empresas"] });
      qc.invalidateQueries({ queryKey: ["empresas-resumo"] });
      setToDelete(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(
        /row-level security|permission/i.test(msg)
          ? "Somente o Administrador Principal pode excluir empresas."
          : `Não foi possível excluir: ${msg}`,
      );
    },
  });

  const rows = lista.data?.rows ?? [];
  const total = lista.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const inicio = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const fim = Math.min(page * PAGE_SIZE, total);

  const filtrosAtivos = search !== "" || status !== "todos" || uf !== "todos";

  const cards = useMemo(
    () => [
      {
        label: "Total de empresas",
        value: resumo.data?.total ?? 0,
        icon: <Building2 className="h-4 w-4 text-gold" />,
      },
      {
        label: "Ativas",
        value: resumo.data?.ativas ?? 0,
        icon: <CheckCircle2 className="h-4 w-4 text-gold" />,
      },
      {
        label: "Inativas",
        value: resumo.data?.inativas ?? 0,
        icon: <XCircle className="h-4 w-4 text-gold" />,
      },
      {
        label: "Tomadores vinculados",
        value: resumo.data?.tomadoresVinculados ?? 0,
        icon: <Users className="h-4 w-4 text-gold" />,
      },
    ],
    [resumo.data],
  );

  function abrirNova() {
    setSelected(null);
    setFormOpen(true);
  }

  function abrirEdicao(empresa: Empresa) {
    setSelected(empresa);
    setFormOpen(true);
  }

  function abrirDetalhes(empresa: Empresa) {
    setSelected(empresa);
    setDetalhesOpen(true);
  }

  function StatusBadge({ value }: { value: string }) {
    return (
      <Badge
        variant="outline"
        className={
          value === "ativa"
            ? "border-gold/40 bg-gold/10 text-gold"
            : "border-border text-muted-foreground"
        }
      >
        {STATUS_EMPRESA_LABELS[value as StatusEmpresa] ?? value}
      </Badge>
    );
  }

  function Acoes({ empresa }: { empresa: Empresa }) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Ações para ${empresa.razao_social}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => abrirDetalhes(empresa)}>
            <Eye className="mr-2 h-4 w-4" /> Ver detalhes
          </DropdownMenuItem>
          {canManage && (
            <DropdownMenuItem onClick={() => abrirEdicao(empresa)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setToDelete(empresa)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const [importOpen, setImportOpen] = useState(false);

  return (
    <PageShell
      title="Empresas (CNPJs)"
      description="Cadastro e controle das empresas do grupo, seus CNPJs, endereços e contatos."
      icon={<Building2 className="h-5 w-5 text-gold-foreground" />}
      actions={
        <>
          {canManage && (
            <Button variant="outline" className="border-border" onClick={() => setImportOpen(true)}>
              <Upload className="mr-1 h-4 w-4" aria-hidden="true" /> Importar
            </Button>
          )}
          {canManage ? (
          <Button
            onClick={abrirNova}
            className="bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
          >
            <Plus className="mr-1 h-4 w-4" /> Nova empresa
          </Button>
        ) : undefined}
        </>
      }
    >
      <div className="space-y-6">
        {/* Cartões de resumo */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-border bg-card p-4 shadow-elegant"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
                {c.icon}
              </div>
              {resumo.isLoading ? (
                <Skeleton className="mt-2 h-7 w-16" />
              ) : (
                <p className="mt-2 text-2xl font-semibold text-foreground">{c.value}</p>
              )}
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-elegant">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label htmlFor="busca-empresas">Buscar</Label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="busca-empresas"
                  className="pl-9"
                  placeholder="Razão social, nome fantasia ou CNPJ"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="filtro-status">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v as StatusEmpresa | "todos");
                  setPage(1);
                }}
              >
                <SelectTrigger id="filtro-status" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="inativa">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="filtro-uf">UF</Label>
              <Select
                value={uf}
                onValueChange={(v) => {
                  setUf(v);
                  setPage(1);
                }}
              >
                <SelectTrigger id="filtro-uf" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {(resumo.data?.ufs ?? []).map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {filtrosAtivos && (
            <div className="mt-3 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchInput("");
                  setStatus("todos");
                  setUf("todos");
                  setPage(1);
                }}
              >
                Limpar filtros
              </Button>
            </div>
          )}
        </div>

        {/* Listagem */}
        {lista.isError ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-center"
          >
            <p className="text-sm text-foreground">
              Não foi possível carregar as empresas.
            </p>
            <Button variant="outline" className="mt-3" onClick={() => lista.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : lista.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center shadow-elegant">
            <h3 className="text-base font-medium text-foreground">
              {filtrosAtivos ? "Nenhuma empresa encontrada" : "Nenhuma empresa cadastrada"}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {filtrosAtivos
                ? "Ajuste a busca ou os filtros para ver outros resultados."
                : "Cadastre a primeira empresa para começar a organizar os CNPJs do grupo."}
            </p>
            {!filtrosAtivos && canManage && (
              <Button
                onClick={abrirNova}
                className="mt-4 bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
              >
                <Plus className="mr-1 h-4 w-4" /> Nova empresa
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-elegant md:block">
              <Table>
                <caption className="sr-only">Lista de empresas cadastradas</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => abrirDetalhes(e)}
                          className="text-left text-sm font-medium text-foreground hover:text-gold"
                        >
                          {e.razao_social}
                        </button>
                        {e.nome_fantasia && (
                          <p className="text-xs text-muted-foreground">{e.nome_fantasia}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{maskCnpj(e.cnpj)}</TableCell>
                      <TableCell className="text-sm">
                        {[e.cidade, e.uf].filter(Boolean).join(" / ") || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="block">{e.responsavel_nome || "—"}</span>
                        <span className="block text-xs text-muted-foreground">
                          {e.telefone ? maskTelefone(e.telefone) : e.email || ""}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={e.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Acoes empresa={e} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile */}
            <div className="space-y-3 md:hidden">
              {rows.map((e) => (
                <article
                  key={e.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-elegant"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <button
                        type="button"
                        onClick={() => abrirDetalhes(e)}
                        className="text-left text-sm font-semibold text-foreground"
                      >
                        {e.razao_social}
                      </button>
                      {e.nome_fantasia && (
                        <p className="text-xs text-muted-foreground">{e.nome_fantasia}</p>
                      )}
                    </div>
                    <Acoes empresa={e} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">CNPJ</dt>
                      <dd className="text-foreground">{maskCnpj(e.cnpj)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Cidade/UF</dt>
                      <dd className="text-foreground">
                        {[e.cidade, e.uf].filter(Boolean).join(" / ") || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Contato</dt>
                      <dd className="text-foreground">
                        {e.telefone ? maskTelefone(e.telefone) : e.email || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Status</dt>
                      <dd>
                        <StatusBadge value={e.status} />
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>

            {/* Paginação */}
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-xs text-muted-foreground" aria-live="polite">
                Exibindo {inicio}–{fim} de {total} empresa(s)
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

        {!canDelete && (
          <p className="text-center text-xs text-muted-foreground">
            Somente o Administrador Principal pode excluir registros neste módulo.
          </p>
        )}
      </div>

      <EmpresaFormSheet open={formOpen} onOpenChange={setFormOpen} empresa={selected} />
      <ImportacaoDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        modulo="empresas"
        invalidateKeys={["empresas", "colaboradores"]}
      />
      <EmpresaDetalhesSheet
        open={detalhesOpen}
        onOpenChange={setDetalhesOpen}
        empresa={selected}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A empresa “{toDelete?.razao_social}” será excluída
              permanentemente e os tomadores vinculados ficarão sem empresa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toDelete && del.mutate(toDelete.id)}
              disabled={del.isPending}
            >
              {del.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
