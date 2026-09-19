import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, Copy, ExternalLink, FileText } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ETAPAS,
  ETAPA_LABELS,
  MODALIDADE_LABELS,
  STATUS_ADMISSAO_LABELS,
  STATUS_DOC_LABELS,
  avancarEtapa,
  definirTreinamentos,
  formatarData,
  getContrato,
  getTransporte,
  getUrlDocumentoAdmissao,
  linkCandidato,
  listDocumentosAdmissao,
  listTreinamentosAdmissao,
  validarDocumento,
  type AdmissaoComRelacoes,
  type EtapaAdmissao,
} from "@/lib/admissao-api";
import { listNrsCatalogo } from "@/lib/nrs-api";
import { useAuth } from "@/lib/auth-context";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admissao: AdmissaoComRelacoes | null;
}

export function AdmissaoDetalhesSheet({ open, onOpenChange, admissao }: Props) {
  const queryClient = useQueryClient();
  const { canManageRh } = useAuth();
  const [nrsSelecionadas, setNrsSelecionadas] = useState<string[]>([]);
  const id = admissao?.id ?? "";

  const documentos = useQuery({
    queryKey: ["admissao-documentos", id],
    queryFn: () => listDocumentosAdmissao(id),
    enabled: open && !!id,
  });
  const transporte = useQuery({
    queryKey: ["admissao-transporte", id],
    queryFn: () => getTransporte(id),
    enabled: open && !!id,
  });
  const treinamentos = useQuery({
    queryKey: ["admissao-treinamentos", id],
    queryFn: () => listTreinamentosAdmissao(id),
    enabled: open && !!id,
  });
  const contrato = useQuery({
    queryKey: ["admissao-contrato", id],
    queryFn: () => getContrato(id),
    enabled: open && !!id,
  });
  const catalogoNrs = useQuery({
    queryKey: ["nrs-catalogo"],
    queryFn: listNrsCatalogo,
    enabled: open,
  });

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["admissao-documentos", id] });
    queryClient.invalidateQueries({ queryKey: ["admissao-treinamentos", id] });
    queryClient.invalidateQueries({ queryKey: ["admissoes"] });
    queryClient.invalidateQueries({ queryKey: ["admissoes-resumo"] });
  };

  const validar = useMutation({
    mutationFn: ({ docId, status }: { docId: string; status: "aprovado" | "reprovado" }) =>
      validarDocumento(docId, status),
    onSuccess: () => {
      toast.success("Documento atualizado.");
      invalidar();
    },
    onError: () => toast.error("Não foi possível validar o documento."),
  });

  const salvarNrs = useMutation({
    mutationFn: async () => {
      const itens = (catalogoNrs.data ?? [])
        .filter((n) => nrsSelecionadas.includes(n.codigo))
        .map((n) => ({ nr_codigo: n.codigo, nome: n.nome }));
      await definirTreinamentos(id, itens);
    },
    onSuccess: () => {
      toast.success("Treinamentos definidos.");
      invalidar();
    },
    onError: () => toast.error("Não foi possível salvar os treinamentos."),
  });

  const mudarEtapa = useMutation({
    mutationFn: (etapa: EtapaAdmissao) => avancarEtapa(id, etapa),
    onSuccess: () => {
      toast.success("Etapa atualizada.");
      invalidar();
    },
    onError: () => toast.error("Não foi possível atualizar a etapa."),
  });

  async function abrirArquivo(path: string | null) {
    if (!path) return;
    const url = await getUrlDocumentoAdmissao(path);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("Não foi possível abrir o arquivo.");
  }

  if (!admissao) return null;
  const link = linkCandidato(admissao.token);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{admissao.nome_completo}</SheetTitle>
          <SheetDescription>
            {admissao.cargo ?? "Cargo não informado"} ·{" "}
            {admissao.empresa?.nome_fantasia || admissao.empresa?.razao_social || "Empresa não definida"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Etapa atual: <strong className="text-foreground">{ETAPA_LABELS[admissao.etapa]}</strong>
            </span>
            <span>{admissao.progresso}%</span>
          </div>
          <Progress value={admissao.progresso} />
          <Badge variant="outline" className="border-gold/40 bg-gold/10 text-gold">
            {STATUS_ADMISSAO_LABELS[admissao.status]}
          </Badge>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(link);
              toast.success("Link copiado.");
            }}
          >
            <Copy className="mr-1 h-3.5 w-3.5" /> Copiar link
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(link, "_blank", "noopener")}>
            <ExternalLink className="mr-1 h-3.5 w-3.5" /> Abrir portal
          </Button>
        </div>

        <Tabs defaultValue="documentos" className="mt-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="transporte">Transporte</TabsTrigger>
            <TabsTrigger value="nrs">NRs</TabsTrigger>
            <TabsTrigger value="contrato">Contrato</TabsTrigger>
          </TabsList>

          <TabsContent value="documentos" className="mt-4 space-y-2">
            {documentos.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {(documentos.data ?? []).map((doc) => (
              <div
                key={doc.id}
                className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {doc.nome}
                    {doc.obrigatorio && <span className="ml-1 text-destructive">*</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {STATUS_DOC_LABELS[doc.status]}
                    {doc.enviado_em ? ` · enviado em ${formatarData(doc.enviado_em)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {doc.arquivo_path && (
                    <Button size="sm" variant="outline" onClick={() => abrirArquivo(doc.arquivo_path)}>
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {canManageRh && doc.arquivo_path && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label="Aprovar documento"
                        onClick={() => validar.mutate({ docId: doc.id, status: "aprovado" })}
                      >
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label="Reprovar documento"
                        onClick={() => validar.mutate({ docId: doc.id, status: "reprovado" })}
                      >
                        <X className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="transporte" className="mt-4">
            {transporte.data ? (
              <div className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
                <p>
                  <span className="text-muted-foreground">Modalidade: </span>
                  {MODALIDADE_LABELS[transporte.data.modalidade]}
                </p>
                {transporte.data.linhas && (
                  <p>
                    <span className="text-muted-foreground">Linhas/itinerário: </span>
                    {transporte.data.linhas}
                  </p>
                )}
                {transporte.data.valor_diario != null && (
                  <p>
                    <span className="text-muted-foreground">Valor diário: </span>R${" "}
                    {Number(transporte.data.valor_diario).toFixed(2)}
                  </p>
                )}
                {transporte.data.placa_veiculo && (
                  <p>
                    <span className="text-muted-foreground">Placa: </span>
                    {transporte.data.placa_veiculo}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Confirmado em {formatarData(transporte.data.confirmado_em)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                O candidato ainda não informou a opção de transporte.
              </p>
            )}
          </TabsContent>

          <TabsContent value="nrs" className="mt-4 space-y-3">
            {(treinamentos.data ?? []).length > 0 && (
              <div className="space-y-2">
                {(treinamentos.data ?? []).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm"
                  >
                    <span>
                      {t.nr_codigo} — {t.nome}
                    </span>
                    <Badge variant="outline">
                      {t.concluido_em ? `Concluído ${formatarData(t.concluido_em)}` : "Pendente"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {canManageRh && (
              <div className="rounded-lg border border-dashed border-border p-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Definir treinamentos obrigatórios
                </Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(catalogoNrs.data ?? []).map((nr) => (
                    <label key={nr.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={
                          nrsSelecionadas.includes(nr.codigo) ||
                          (treinamentos.data ?? []).some((t) => t.nr_codigo === nr.codigo)
                        }
                        onCheckedChange={(v) =>
                          setNrsSelecionadas((prev) => {
                            const base = new Set([
                              ...prev,
                              ...(treinamentos.data ?? []).map((t) => t.nr_codigo),
                            ]);
                            if (v) base.add(nr.codigo);
                            else base.delete(nr.codigo);
                            return Array.from(base);
                          })
                        }
                      />
                      {nr.codigo} — {nr.nome}
                    </label>
                  ))}
                </div>
                <Button
                  size="sm"
                  className="mt-3"
                  disabled={salvarNrs.isPending}
                  onClick={() => salvarNrs.mutate()}
                >
                  Salvar treinamentos
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="contrato" className="mt-4 space-y-3">
            {contrato.data?.aceito_em ? (
              <div className="rounded-lg border border-border bg-card p-4 text-sm">
                <p className="font-medium text-foreground">Contrato aceito pelo candidato</p>
                <p className="text-muted-foreground">
                  Assinado por {contrato.data.assinatura_nome} em {formatarData(contrato.data.aceito_em)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                O contrato ainda não foi aceito pelo candidato.
              </p>
            )}
          </TabsContent>
        </Tabs>

        {canManageRh && admissao.status !== "cancelada" && (
          <div className="mt-6 border-t border-border pt-4">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Mover para etapa
            </Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ETAPAS.map((etapa) => (
                <Button
                  key={etapa}
                  size="sm"
                  variant={etapa === admissao.etapa ? "default" : "outline"}
                  disabled={mudarEtapa.isPending}
                  onClick={() => mudarEtapa.mutate(etapa)}
                >
                  {ETAPA_LABELS[etapa]}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 space-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
          <p>CPF: {admissao.cpf}</p>
          <p>Tomador: {admissao.tomador?.razao_social ?? "—"}</p>
          <p>Data prevista: {formatarData(admissao.data_prevista)}</p>
          <p>Última atualização: {formatarData(admissao.updated_at)}</p>
          <Input readOnly value={link} className="mt-2 text-xs" aria-label="Link do candidato" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
