import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  UserPlus,
  Plus,
  Search,
  LayoutGrid,
  List,
  Copy,
  Send,
  Eye,
  Pencil,
  Ban,
  MoreHorizontal,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdmissaoFormSheet } from "@/components/admissao/admissao-form-sheet";
import { AdmissaoDetalhesSheet } from "@/components/admissao/admissao-detalhes-sheet";
import {
  ETAPAS,
  ETAPA_LABELS,
  STATUS_ADMISSAO_LABELS,
  cancelarAdmissao,
  formatarData,
  getAdmissoesResumo,
  linkCandidato,
  listAdmissoesKanban,
  listAdmissoesPaged,
  marcarLinkEnviado,
  type AdmissaoComRelacoes,
  type EtapaAdmissao,
  type StatusAdmissao,
} from "@/lib/admissao-api";
import { listEmpresasPaged } from "@/lib/empresas-api";
import { listTomadores } from "@/lib/colaboradores-api";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/admissao-digital")({
  head: () => ({
    meta: [
      { title: "Admissão Digital — Gestão de RH" },
      {
        name: "description",
        content: "Processo de admissão digital: documentos, transporte, NRs e contrato.",
      },
      { property: "og:title", content: "Admissão Digital — Gestão de RH" },
      {
        property: "og:description",
        content: "Acompanhe cada admissão do envio de documentos até a conclusão do contrato.",
      },
    ],
  }),
  component: AdmissaoDigitalPage,
});

const PAGE_SIZE = 10;

function AdmissaoDigitalPage() {
  const { canManageRh } = useAuth();
  const queryClient = useQueryClient();

  const [visao, setVisao] = useState<"tabela" | "kanban">("tabela");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusAdmissao | "todos">("todos");
  const [etapa, setEtapa] = useState<EtapaAdmissao | "todos">("todos");
  const [empresaId, setEmpresaId] = useState<string>("todos");
  const [tomadorId, setTomadorId] = useState<string>("todos");
  const [cargo, setCargo] = useState<string>("todos");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<AdmissaoComRelacoes | null>(null);
  const [detalhes, setDetalhes] = useState<AdmissaoComRelacoes | null>(null);

  const filtros = { search, status, etapa, empresaId, tomadorId, cargo, de, ate, page, pageSize: PAGE_SIZE };

  const lista = useQuery({
    queryKey: ["admissoes", filtros],
    queryFn: () => listAdmissoesPaged(filtros),
  });
  const kanban = useQuery({
    queryKey: ["admissoes", "kanban"],
    queryFn: listAdmissoesKanban,
    enabled: visao === "kanban",
  });
  const resumo = useQuery({ queryKey: ["admissoes-resumo"], queryFn: getAdmissoesResumo });
  const { data: empresas } = useQuery({
    queryKey: ["empresas-lista"],
    queryFn: async () => (await listEmpresasPaged({ page: 1, pageSize: 500 })).rows,
  });
  const { data: tomadores } = useQuery({ queryKey: ["tomadores-lista"], queryFn: listTomadores });

  const cancelar = useMutation({
    mutationFn: (id: string) => cancelarAdmissao(id, "Cancelada pelo RH"),
    onSuccess: () => {
      toast.success("Admissão cancelada.");
      queryClient.invalidateQueries({ queryKey: ["admissoes"] });
      queryClient.invalidateQueries({ queryKey: ["admissoes-resumo"] });
    },
    onError: () => toast.error("Não foi possível cancelar."),
  });

  const cards = useMemo(
    () => [
      { label: "Total de admissões", value: resumo.data?.total ?? 0 },
      { label: "Em andamento", value: resumo.data?.emAndamento ?? 0 },
      { label: "Aguardando documentos", value: resumo.data?.aguardandoDocumentos ?? 0 },
      { label: "Documentos em validação", value: resumo.data?.documentosEmValidacao ?? 0 },
      { label: "Transporte pendente", value: resumo.data?.transportePendente ?? 0 },
      { label: "Treinamentos pendentes", value: resumo.data?.treinamentosPendentes ?? 0 },
      { label: "Contratos pendentes", value: resumo.data?.contratosPendentes ?? 0 },
      { label: "Concluídas", value: resumo.data?.concluidas ?? 0 },
    ],
    [resumo.data],
  );

  const totalPaginas = Math.max(1, Math.ceil((lista.data?.total ?? 0) / PAGE_SIZE));

  function copiarLink(a: AdmissaoComRelacoes) {
    navigator.clipboard.writeText(linkCandidato(a.token));
    toast.success("Link do candidato copiado.");
  }

  async function enviarLink(a: AdmissaoComRelacoes) {
    const link = linkCandidato(a.token);
    await marcarLinkEnviado(a.id);
    queryClient.invalidateQueries({ queryKey: ["admissoes"] });
    if (a.telefone) {
      const texto = encodeURIComponent(
        `Olá, ${a.nome_completo}! Conclua seu processo de admissão neste link: ${link}`,
      );
      window.open(`https://wa.me/55${a.telefone}?text=${texto}`, "_blank", "noopener");
      return;
    }
    if (a.email) {
      window.open(
        `mailto:${a.email}?subject=${encodeURIComponent("Admissão digital")}&body=${encodeURIComponent(
          `Olá, ${a.nome_completo}! Conclua seu processo de admissão neste link: ${link}`,
        )}`,
        "_blank",
      );
      return;
    }
    toast.info("Cadastre e-mail ou telefone do candidato para enviar o link.");
  }

  return (
    <PageShell
      title="Admissão Digital"
      description="Do cadastro do candidato até a conclusão do contrato, em um único fluxo."
      icon={<UserPlus className="h-5 w-5 text-gold-foreground" />}
      actions={
        canManageRh ? (
          <Button
            className="bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
            onClick={() => {
              setEditando(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Nova admissão
          </Button>
        ) : undefined
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4 shadow-elegant">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, CPF ou e-mail"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="Buscar admissões"
          />
        </div>
        <Tabs value={visao} onValueChange={(v) => setVisao(v as "tabela" | "kanban")}>
          <TabsList>
            <TabsTrigger value="tabela">
              <List className="mr-1 h-4 w-4" /> Tabela
            </TabsTrigger>
            <TabsTrigger value="kanban">
              <LayoutGrid className="mr-1 h-4 w-4" /> Kanban
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <Select value={status} onValueChange={(v) => setStatus(v as StatusAdmissao | "todos")}>
          <SelectTrigger aria-label="Status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(STATUS_ADMISSAO_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={etapa} onValueChange={(v) => setEtapa(v as EtapaAdmissao | "todos")}>
          <SelectTrigger aria-label="Etapa">
            <SelectValue placeholder="Etapa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as etapas</SelectItem>
            {ETAPAS.map((e) => (
              <SelectItem key={e} value={e}>
                {ETAPA_LABELS[e]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={empresaId} onValueChange={setEmpresaId}>
          <SelectTrigger aria-label="Empresa">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as empresas</SelectItem>
            {(empresas ?? []).map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.nome_fantasia || e.razao_social}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tomadorId} onValueChange={setTomadorId}>
          <SelectTrigger aria-label="Tomador">
            <SelectValue placeholder="Tomador" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tomadores</SelectItem>
            {(tomadores ?? []).map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.nome_fantasia || t.razao_social}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cargo} onValueChange={setCargo}>
          <SelectTrigger aria-label="Cargo">
            <SelectValue placeholder="Cargo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os cargos</SelectItem>
            {(resumo.data?.cargos ?? []).map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} aria-label="Data inicial" />
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} aria-label="Data final" />
        </div>
      </div>

      {visao === "tabela" ? (
        <div className="mt-4 rounded-xl border border-border bg-card shadow-elegant">
          {lista.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando admissões...</p>
          ) : lista.isError ? (
            <p className="p-6 text-sm text-destructive">
              Não foi possível carregar as admissões. Tente novamente.
            </p>
          ) : (lista.data?.rows.length ?? 0) === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Nenhuma admissão encontrada com os filtros atuais.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidato</TableHead>
                    <TableHead className="hidden md:table-cell">CPF</TableHead>
                    <TableHead className="hidden lg:table-cell">Empresa</TableHead>
                    <TableHead className="hidden lg:table-cell">Tomador/Unidade</TableHead>
                    <TableHead className="hidden md:table-cell">Cargo</TableHead>
                    <TableHead className="hidden md:table-cell">Prevista</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Progresso</TableHead>
                    <TableHead className="hidden xl:table-cell">Atualização</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(lista.data?.rows ?? []).map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.nome_completo}</TableCell>
                      <TableCell className="hidden md:table-cell">{a.cpf}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {a.empresa?.nome_fantasia || a.empresa?.razao_social || "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {a.tomador?.razao_social || a.unidade || "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{a.cargo ?? "—"}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {formatarData(a.data_prevista)}
                      </TableCell>
                      <TableCell>{ETAPA_LABELS[a.etapa]}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-gold/40 bg-gold/10 text-gold">
                          {STATUS_ADMISSAO_LABELS[a.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <Progress value={a.progresso} className="w-16" />
                          <span className="text-xs text-muted-foreground">{a.progresso}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {formatarData(a.updated_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" aria-label="Ações da admissão">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetalhes(a)}>
                              <Eye className="mr-2 h-4 w-4" /> Visualizar
                            </DropdownMenuItem>
                            {canManageRh && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditando(a);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil className="mr-2 h-4 w-4" /> Editar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => copiarLink(a)}>
                              <Copy className="mr-2 h-4 w-4" /> Copiar link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => enviarLink(a)}>
                              <Send className="mr-2 h-4 w-4" /> Enviar link
                            </DropdownMenuItem>
                            {canManageRh && a.status !== "cancelada" && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => cancelar.mutate(a.id)}
                              >
                                <Ban className="mr-2 h-4 w-4" /> Cancelar admissão
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
          )}

          <div className="flex items-center justify-between border-t border-border p-3 text-xs text-muted-foreground">
            <span>
              {lista.data?.total ?? 0} admissões · página {page} de {totalPaginas}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPaginas}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-5">
          {ETAPAS.map((et) => {
            const itens = (kanban.data ?? []).filter((a) => a.etapa === et);
            return (
              <div key={et} className="rounded-xl border border-border bg-card p-3 shadow-elegant">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{ETAPA_LABELS[et]}</h3>
                  <Badge variant="outline">{itens.length}</Badge>
                </div>
                <div className="space-y-2">
                  {itens.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setDetalhes(a)}
                      className="w-full rounded-lg border border-border bg-background p-3 text-left transition-colors hover:border-gold/50"
                    >
                      <p className="truncate text-sm font-medium text-foreground">{a.nome_completo}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.cargo ?? "Cargo não informado"}</p>
                      <Progress value={a.progresso} className="mt-2" />
                    </button>
                  ))}
                  {itens.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhuma admissão nesta etapa.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AdmissaoFormSheet open={formOpen} onOpenChange={setFormOpen} admissao={editando} />
      <AdmissaoDetalhesSheet
        open={!!detalhes}
        onOpenChange={(o) => !o && setDetalhes(null)}
        admissao={detalhes}
      />
    </PageShell>
  );
}
