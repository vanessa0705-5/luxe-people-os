import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Search, Pencil, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  listColaboradores,
  listTomadores,
  STATUS_LABELS,
  type Colaborador,
  type StatusColaborador,
} from "@/lib/colaboradores-api";
import { ColaboradorFormSheet } from "@/components/colaboradores/colaborador-form-sheet";

export const Route = createFileRoute("/_app/colaboradores")({
  head: () => ({
    meta: [
      { title: "Colaboradores — Gestão de RH" },
      { name: "description", content: "Gestão completa de colaboradores da empresa." },
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

function ColaboradoresPage() {
  const { hasRole, canDelete, isAdminPrincipal } = useAuth();
  const canManage = isAdminPrincipal || hasRole("rh");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusColaborador | "todos">("todos");
  const [tomadorId, setTomadorId] = useState<string>("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Colaborador | null>(null);
  const [toDelete, setToDelete] = useState<Colaborador | null>(null);

  const qc = useQueryClient();

  const { data: colaboradores = [], isLoading } = useQuery({
    queryKey: ["colaboradores", { search, status, tomadorId }],
    queryFn: () => listColaboradores({ search, status, tomadorId }),
  });

  const { data: tomadores = [] } = useQuery({
    queryKey: ["tomadores", "ativos"],
    queryFn: listTomadores,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteColaborador(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["colaboradores"] });
      toast.success("Colaborador excluído");
      setToDelete(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageShell
      title="Colaboradores"
      description="Cadastro completo e gestão de colaboradores."
      icon={<Users className="h-5 w-5 text-gold-foreground" />}
      actions={
        canManage && (
          <Button
            className="bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Novo Colaborador
          </Button>
        )
      }
    >
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-elegant md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF ou matrícula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as never)}>
          <SelectTrigger className="w-full md:w-44">
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
        <Select value={tomadorId} onValueChange={setTomadorId}>
          <SelectTrigger className="w-full md:w-56">
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
      </div>

      <div className="rounded-xl border border-border bg-card shadow-elegant">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Matrícula</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Tomador</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : colaboradores.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum colaborador encontrado.
                </TableCell>
              </TableRow>
            ) : (
              colaboradores.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome_completo}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.matricula ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.cargo ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.tomador?.razao_social ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusVariant[c.status as StatusColaborador]}
                    >
                      {STATUS_LABELS[c.status as StatusColaborador]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" asChild>
                        <Link
                          to="/colaboradores/$id"
                          params={{ id: c.id }}
                          aria-label="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      {canManage && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditing(c);
                            setFormOpen(true);
                          }}
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setToDelete(c)}
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!canManage && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Seu perfil tem acesso somente de leitura neste módulo.
        </p>
      )}

      <ColaboradorFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        colaborador={editing}
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
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
