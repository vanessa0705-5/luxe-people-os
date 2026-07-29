import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Trash2, Plus, User } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createDependente,
  deleteDependente,
  deleteColaborador,
  getColaborador,
  listDependentes,
  ESTADO_CIVIL_LABELS,
  SEXO_LABELS,
  STATUS_LABELS,
  TIPO_CONTRATO_LABELS,
  type DependenteInsert,
  type StatusColaborador,
} from "@/lib/colaboradores-api";
import { useAuth } from "@/lib/auth-context";
import { ColaboradorFormSheet } from "@/components/colaboradores/colaborador-form-sheet";

export const Route = createFileRoute("/_app/colaboradores/$id")({
  head: () => ({
    meta: [
      { title: "Detalhes do Colaborador — Gestão de RH" },
      { name: "description", content: "Detalhes completos e histórico do colaborador." },
    ],
  }),
  component: ColaboradorDetalhePage,
});

function ColaboradorDetalhePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { hasRole, canDelete, isAdminPrincipal } = useAuth();
  const canManage = isAdminPrincipal || hasRole("rh");
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: colaborador, isLoading } = useQuery({
    queryKey: ["colaboradores", id],
    queryFn: () => getColaborador(id),
  });

  const qc = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: () => deleteColaborador(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["colaboradores"] });
      toast.success("Colaborador excluído");
      navigate({ to: "/colaboradores" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <PageShell title="Carregando..." icon={<User className="h-5 w-5 text-gold-foreground" />}>
        <div className="py-10 text-center text-sm text-muted-foreground">Carregando...</div>
      </PageShell>
    );
  }

  if (!colaborador) {
    return (
      <PageShell title="Não encontrado" icon={<User className="h-5 w-5 text-gold-foreground" />}>
        <div className="py-10 text-center text-sm text-muted-foreground">
          Colaborador não encontrado.
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={colaborador.nome_completo}
      description={`${colaborador.cargo ?? "Cargo não informado"} • ${colaborador.tomador?.razao_social ?? "Sem tomador"}`}
      icon={<User className="h-5 w-5 text-gold-foreground" />}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/colaboradores">
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Link>
          </Button>
          {canManage && (
            <Button
              className="bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="mr-1 h-4 w-4" /> Editar
            </Button>
          )}
          {canDelete && (
            <Button
              variant="outline"
              className="border-destructive/50 text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-1 h-4 w-4" /> Excluir
            </Button>
          )}
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-gold/40 bg-gold/10 text-gold">
          Matrícula: {colaborador.matricula ?? "—"}
        </Badge>
        <Badge variant="outline">
          Status: {STATUS_LABELS[colaborador.status as StatusColaborador]}
        </Badge>
        {colaborador.tipo_contrato && (
          <Badge variant="outline">{TIPO_CONTRATO_LABELS[colaborador.tipo_contrato]}</Badge>
        )}
      </div>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="dependentes">Dependentes</TabsTrigger>
          <TabsTrigger value="ferias">Férias</TabsTrigger>
          <TabsTrigger value="movimentacoes">Movimentações</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados Pessoais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Info label="CPF" value={colaborador.cpf} />
                <Info
                  label="RG"
                  value={
                    [colaborador.rg, colaborador.rg_orgao_emissor].filter(Boolean).join(" / ")
                  }
                />
                <Info label="Data de nascimento" value={colaborador.data_nascimento} />
                <Info label="Sexo" value={colaborador.sexo && SEXO_LABELS[colaborador.sexo]} />
                <Info
                  label="Estado civil"
                  value={colaborador.estado_civil && ESTADO_CIVIL_LABELS[colaborador.estado_civil]}
                />
                <Info label="Nacionalidade" value={colaborador.nacionalidade} />
                <Info label="Telefone" value={colaborador.telefone} />
                <Info label="E-mail" value={colaborador.email} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados Contratuais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Info label="Cargo" value={colaborador.cargo} />
                <Info label="Função" value={colaborador.funcao} />
                <Info label="Departamento" value={colaborador.departamento} />
                <Info label="Admissão" value={colaborador.data_admissao} />
                <Info label="Desligamento" value={colaborador.data_desligamento} />
                <Info
                  label="Salário"
                  value={
                    colaborador.salario != null
                      ? `R$ ${Number(colaborador.salario).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}`
                      : null
                  }
                />
                <Info
                  label="Jornada"
                  value={colaborador.jornada_semanal ? `${colaborador.jornada_semanal}h/semana` : null}
                />
                <Info
                  label="Pagamento"
                  value={
                    [colaborador.banco, colaborador.agencia, colaborador.conta]
                      .filter(Boolean)
                      .join(" / ")
                  }
                />
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Endereço</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Info label="CEP" value={colaborador.cep} />
                <Info
                  label="Endereço"
                  value={[
                    colaborador.logradouro,
                    colaborador.numero,
                    colaborador.complemento,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                />
                <Info
                  label="Bairro / Cidade / UF"
                  value={[colaborador.bairro, colaborador.cidade, colaborador.uf]
                    .filter(Boolean)
                    .join(" — ")}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="documentos" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documentos Trabalhistas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm md:grid-cols-2">
              <Info
                label="CTPS"
                value={
                  [colaborador.ctps_numero, colaborador.ctps_serie].filter(Boolean).join(" / ")
                }
              />
              <Info label="PIS/PASEP" value={colaborador.pis_pasep} />
              <Info
                label="Título de eleitor"
                value={[
                  colaborador.titulo_eleitor,
                  colaborador.titulo_zona && `Zona ${colaborador.titulo_zona}`,
                  colaborador.titulo_secao && `Seção ${colaborador.titulo_secao}`,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              />
              <Info label="Reservista" value={colaborador.reservista} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dependentes" className="pt-4">
          <DependentesSection colaboradorId={colaborador.id} canManage={canManage} canDelete={canDelete} />
        </TabsContent>

        <TabsContent value="ferias" className="pt-4">
          <EmptyTab
            title="Férias"
            message="O módulo de férias exibirá aqui o histórico e o saldo de férias deste colaborador."
          />
        </TabsContent>

        <TabsContent value="movimentacoes" className="pt-4">
          <EmptyTab
            title="Movimentações"
            message="Histórico de promoções, transferências e demais movimentações será exibido aqui."
          />
        </TabsContent>
      </Tabs>

      <ColaboradorFormSheet open={editOpen} onOpenChange={setEditOpen} colaborador={colaborador} />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir colaborador?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação é irreversível. Deseja excluir <strong>{colaborador.nome_completo}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value || "—"}</span>
    </div>
  );
}

function EmptyTab({ title, message }: { title: string; message: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

function DependentesSection({
  colaboradorId,
  canManage,
  canDelete,
}: {
  colaboradorId: string;
  canManage: boolean;
  canDelete: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<DependenteInsert>>({
    usa_ir: false,
    usa_salario_familia: false,
  });

  const { data: dependentes = [], isLoading } = useQuery({
    queryKey: ["dependentes", colaboradorId],
    queryFn: () => listDependentes(colaboradorId),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!form.nome_completo || !form.parentesco) {
        throw new Error("Nome e parentesco são obrigatórios");
      }
      return createDependente({
        colaborador_id: colaboradorId,
        nome_completo: form.nome_completo,
        parentesco: form.parentesco,
        cpf: form.cpf ?? null,
        data_nascimento: form.data_nascimento ?? null,
        usa_ir: !!form.usa_ir,
        usa_salario_familia: !!form.usa_salario_familia,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dependentes", colaboradorId] });
      toast.success("Dependente adicionado");
      setForm({ usa_ir: false, usa_salario_familia: false });
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteDependente(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dependentes", colaboradorId] });
      toast.success("Dependente removido");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Dependentes</CardTitle>
        {canManage && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Parentesco</TableHead>
              <TableHead>Nascimento</TableHead>
              <TableHead>IR</TableHead>
              <TableHead>Sal. Família</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : dependentes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum dependente cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              dependentes.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.nome_completo}</TableCell>
                  <TableCell>{d.parentesco}</TableCell>
                  <TableCell>{d.data_nascimento ?? "—"}</TableCell>
                  <TableCell>{d.usa_ir ? "Sim" : "Não"}</TableCell>
                  <TableCell>{d.usa_salario_familia ? "Sim" : "Não"}</TableCell>
                  <TableCell className="text-right">
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteMut.mutate(d.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo dependente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome completo *</Label>
              <Input
                value={form.nome_completo ?? ""}
                onChange={(e) => setForm({ ...form, nome_completo: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Parentesco *</Label>
                <Input
                  placeholder="Filho(a), Cônjuge..."
                  value={form.parentesco ?? ""}
                  onChange={(e) => setForm({ ...form, parentesco: e.target.value })}
                />
              </div>
              <div>
                <Label>CPF</Label>
                <Input
                  value={form.cpf ?? ""}
                  onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Data de nascimento</Label>
              <Input
                type="date"
                value={form.data_nascimento ?? ""}
                onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={!!form.usa_ir}
                  onCheckedChange={(v) => setForm({ ...form, usa_ir: !!v })}
                />
                Usa para IR
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={!!form.usa_salario_familia}
                  onCheckedChange={(v) => setForm({ ...form, usa_salario_familia: !!v })}
                />
                Salário-família
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
