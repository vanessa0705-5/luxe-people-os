import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, MoreHorizontal, Pencil, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
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
import { NrFormSheet } from "@/components/nrs/nr-form-sheet";
import { useAuth } from "@/lib/auth-context";
import { formatarData, getUrlDocumentoSst } from "@/lib/aso-api";
import {
  SITUACAO_TREINAMENTO_LABELS,
  deleteTreinamento,
  getNrsResumo,
  listNrsCatalogo,
  listTreinamentosPaged,
  situacaoTreinamento,
  type NrTreinamentoComRelacoes,
  type SituacaoTreinamento,
} from "@/lib/nrs-api";

export const Route = createFileRoute("/_app/nrs")({
  head: () => ({
    meta: [
      { title: "NRs — Normas Regulamentadoras" },
      {
        name: "description",
        content:
          "Controle de treinamentos de Normas Regulamentadoras: validade, certificados e conformidade.",
      },
      { property: "og:title", content: "NRs — Normas Regulamentadoras" },
      {
        property: "og:description",
        content: "Gestão de treinamentos de NRs, validades e certificados dos colaboradores.",
      },
    ],
  }),
  component: NrsPage,
});

const PAGE_SIZE = 10;

function situacaoBadge(s: SituacaoTreinamento) {
  const classes: Record<SituacaoTreinamento, string> = {
    valido: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    a_vencer: "border-amber-500/40 bg-amber-500/10 text-amber-400",
    vencido: "border-destructive/40 bg-destructive/10 text-destructive",
    sem_validade: "border-border bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={classes[s]}>
      {SITUACAO_TREINAMENTO_LABELS[s]}
    </Badge>
  );
}

function NrsPage() {
  const { canManageSst, canDelete } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [nrCodigo, setNrCodigo] = useState<string>("todos");
  const [situacao, setSituacao] = useState<SituacaoTreinamento | "todos">("todos");
  const [unidade, setUnidade] = useState<string>("todos");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [registro, setRegistro] = useState<NrTreinamentoComRelacoes | null>(null);
  const [paraExcluir, setParaExcluir] = useState<NrTreinamentoComRelacoes | null>(null);

  const filtros = { search, nrCodigo, situacao, unidade, page, pageSize: PAGE_SIZE };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["nr-treinamentos", filtros],
    queryFn: () => listTreinamentosPaged(filtros),
  });
  const { data: resumo } = useQuery({ queryKey: ["nr-treinamentos", "resumo"], queryFn: getNrsResumo });
  const { data: catalogo = [] } = useQuery({ queryKey: ["nrs-catalogo"], queryFn: listNrsCatalogo });

  const deleteMut = useMutation({
    mutationFn: (t: NrTreinamentoComRelacoes) => deleteTreinamento(t),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nr-treinamentos"] });
      toast.success("Treinamento excluído.");
      setParaExcluir(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  const cards = [
    { label: "Treinamentos", value: resumo?.total ?? 0 },
    { label: "Válidos", value: resumo?.validos ?? 0 },
    { label: "A vencer em 30 dias", value: resumo?.aVencer30 ?? 0 },
    { label: "Vencidos", value: resumo?.vencidos ?? 0, alerta: true },
  ];

  async function abrirAnexo(path: string) {
    try {
      const url = await getUrlDocumentoSst(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível abrir o certificado.");
    }
  }

  function comReset<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  return (
    <PageShell
      title="NRs"
      description="Treinamentos de Normas Regulamentadoras, validade e certificados."
      icon={<ShieldCheck className="h-5 w-5 text-gold-foreground" />}
      actions={
        canManageSst ? (
          <Button
            className="bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
            onClick={() => {
              setRegistro(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Novo treinamento
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
            placeholder="Buscar por colaborador, NR, treinamento ou instrutor"
            aria-label="Buscar treinamentos"
            value={search}
            onChange={(e) => comReset(setSearch)(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select value={nrCodigo} onValueChange={comReset(setNrCodigo)}>
            <SelectTrigger aria-label="Norma regulamentadora">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as NRs</SelectItem>
              {catalogo.map((n) => (
                <SelectItem key={n.id} value={n.codigo}>
                  {n.codigo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={situacao}
            onValueChange={comReset((v) => setSituacao(v as SituacaoTreinamento | "todos"))}
          >
            <SelectTrigger aria-label="Situação">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as situações</SelectItem>
              <SelectItem value="valido">Válido</SelectItem>
              <SelectItem value="a_vencer">A vencer</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="sem_validade">Sem validade</SelectItem>
            </SelectContent>
          </Select>
          <Select value={unidade} onValueChange={comReset(setUnidade)}>
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
                {error instanceof Error ? error.message : "Erro ao carregar os treinamentos."}
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
                    <TableHead>NR</TableHead>
                    <TableHead>Treinamento</TableHead>
                    <TableHead>Realização</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        Carregando treinamentos...
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        Nenhum treinamento encontrado com os filtros atuais.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <p className="font-medium text-foreground">
                            {t.colaborador?.nome_completo ?? "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t.cargo || t.colaborador?.cargo || "Cargo não informado"}
                            {t.unidade ? ` • ${t.unidade}` : ""}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-gold/40 bg-gold/10 text-gold">
                            {t.nr_codigo}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate">{t.nome_treinamento}</TableCell>
                        <TableCell>{formatarData(t.data_realizacao)}</TableCell>
                        <TableCell>{formatarData(t.data_validade)}</TableCell>
                        <TableCell>{situacaoBadge(situacaoTreinamento(t.data_validade))}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" aria-label="Ações do treinamento">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {t.certificado_path && (
                                <DropdownMenuItem onClick={() => abrirAnexo(t.certificado_path!)}>
                                  <Download className="mr-2 h-4 w-4" /> Ver certificado
                                </DropdownMenuItem>
                              )}
                              {canManageSst && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setRegistro(t);
                                    setFormOpen(true);
                                  }}
                                >
                                  <Pencil className="mr-2 h-4 w-4" /> Editar
                                </DropdownMenuItem>
                              )}
                              {canDelete && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setParaExcluir(t)}
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
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
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

      <NrFormSheet open={formOpen} onOpenChange={setFormOpen} registro={registro} />

      <Dialog open={!!paraExcluir} onOpenChange={(o) => !o && setParaExcluir(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir treinamento?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação é irreversível e também remove o certificado anexado.
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
