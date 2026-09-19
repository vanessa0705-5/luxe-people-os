import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Upload, ChevronLeft, ChevronRight, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  aceitarContratoAdmissao,
  definirEtapaAdmissao,
  enviarDocumentoAdmissao,
  getAdmissaoPublica,
  salvarTransporteAdmissao,
} from "@/lib/admissao-publica.functions";

export const Route = createFileRoute("/admissao/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admissão Digital — Portal do Candidato" },
      {
        name: "description",
        content: "Envie seus documentos e conclua seu processo de admissão pelo celular.",
      },
      { property: "og:title", content: "Admissão Digital — Portal do Candidato" },
      {
        property: "og:description",
        content: "Envie seus documentos e conclua seu processo de admissão.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalCandidato,
});

const ETAPAS = ["documentos", "transporte", "treinamentos", "contrato"] as const;
const ETAPA_TITULOS: Record<string, string> = {
  documentos: "Documentos",
  transporte: "Transporte",
  treinamentos: "Treinamentos",
  contrato: "Contrato",
  concluida: "Concluído",
};

async function arquivoParaBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

function PortalCandidato() {
  const { token } = Route.useParams();
  const queryClient = useQueryClient();
  const carregar = useServerFn(getAdmissaoPublica);
  const enviarDoc = useServerFn(enviarDocumentoAdmissao);
  const salvarTransporte = useServerFn(salvarTransporteAdmissao);
  const aceitarContrato = useServerFn(aceitarContratoAdmissao);
  const mudarEtapa = useServerFn(definirEtapaAdmissao);

  const consulta = useQuery({
    queryKey: ["admissao-publica", token],
    queryFn: () => carregar({ data: { token } }),
    retry: false,
  });

  const [modalidade, setModalidade] = useState<"vt" | "vc" | "proprio" | "nenhum">("vt");
  const [linhas, setLinhas] = useState("");
  const [placa, setPlaca] = useState("");
  const [assinatura, setAssinatura] = useState("");
  const [enviandoId, setEnviandoId] = useState<string | null>(null);

  const dados = consulta.data;

  useEffect(() => {
    if (dados?.transporte) {
      setModalidade(dados.transporte.modalidade as typeof modalidade);
      setLinhas(dados.transporte.linhas ?? "");
      setPlaca(dados.transporte.placa_veiculo ?? "");
    }
    if (dados?.admissao && !assinatura) setAssinatura(dados.admissao.nome_completo);
  }, [dados]);

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["admissao-publica", token] });

  const upload = useMutation({
    mutationFn: async ({ documentoId, file }: { documentoId: string; file: File }) => {
      if (file.size > 18 * 1024 * 1024) throw new Error("O arquivo deve ter no máximo 18 MB.");
      const base64 = await arquivoParaBase64(file);
      await enviarDoc({
        data: {
          token,
          documentoId,
          nomeArquivo: file.name,
          mime: file.type || "application/octet-stream",
          base64,
        },
      });
    },
    onSuccess: () => {
      toast.success("Documento enviado.");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível enviar o arquivo."),
    onSettled: () => setEnviandoId(null),
  });

  const transporteMut = useMutation({
    mutationFn: () =>
      salvarTransporte({
        data: {
          token,
          modalidade,
          linhas: linhas || undefined,
          placa_veiculo: placa || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Informações de transporte salvas.");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const contratoMut = useMutation({
    mutationFn: () => aceitarContrato({ data: { token, assinatura_nome: assinatura.trim() } }),
    onSuccess: () => {
      toast.success("Contrato aceito. Admissão concluída!");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const etapaMut = useMutation({
    mutationFn: (etapa: (typeof ETAPAS)[number]) => mudarEtapa({ data: { token, etapa } }),
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message),
  });

  if (consulta.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  if (consulta.isError || !dados) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold text-foreground">Link indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {(consulta.error as Error)?.message ??
              "Este link de admissão não é válido. Fale com o RH da empresa."}
          </p>
        </div>
      </div>
    );
  }

  const { admissao, documentos, treinamentos, contrato } = dados;
  const concluida = admissao.status === "concluida";
  const etapaAtual = concluida ? "concluida" : (admissao.etapa as (typeof ETAPAS)[number]);
  const indice = concluida ? 4 : ETAPAS.indexOf(etapaAtual as (typeof ETAPAS)[number]);
  const progresso = Math.round((indice / 4) * 100);
  const obrigatoriosPendentes = documentos.filter(
    (d) => d.obrigatorio && (d.status === "pendente" || d.status === "reprovado"),
  ).length;

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="border-b border-border bg-card/90 px-4 py-5 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gold">Admissão Digital</p>
          <h1 className="mt-1 text-xl font-semibold text-foreground">
            Olá, {admissao.nome_completo.split(" ")[0]}!
          </h1>
          <p className="text-sm text-muted-foreground">Vamos concluir seu processo de admissão.</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <section className="rounded-xl border border-border bg-card p-4 shadow-elegant">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Etapa {Math.min(indice + 1, 5)} de 5 — {ETAPA_TITULOS[etapaAtual]}
            </span>
            <span className="font-semibold text-gold">{progresso}% concluído</span>
          </div>
          <Progress value={progresso} className="mt-2" />
          <ol className="mt-3 grid grid-cols-5 gap-1 text-[10px] text-muted-foreground">
            {[...ETAPAS, "concluida"].map((e, i) => (
              <li
                key={e}
                className={`rounded px-1 py-1 text-center ${
                  i <= indice ? "bg-gold/15 font-semibold text-gold" : ""
                }`}
              >
                {i + 1}. {ETAPA_TITULOS[e]}
              </li>
            ))}
          </ol>
        </section>

        {concluida ? (
          <section className="mt-6 rounded-xl border border-border bg-card p-6 text-center shadow-elegant">
            <FileCheck2 className="mx-auto h-10 w-10 text-gold" />
            <h2 className="mt-3 text-lg font-semibold text-foreground">Admissão concluída!</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Recebemos todas as suas informações. O RH entrará em contato com os próximos passos.
            </p>
          </section>
        ) : (
          <>
            {etapaAtual === "documentos" && (
              <section className="mt-6 space-y-3">
                <h2 className="text-base font-semibold text-foreground">Envie seus documentos</h2>
                <p className="text-sm text-muted-foreground">
                  Fotos nítidas ou PDFs. Você pode salvar e continuar depois.
                </p>
                {documentos.map((doc) => (
                  <div key={doc.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {doc.nome}
                          {doc.obrigatorio && <span className="ml-1 text-destructive">*</span>}
                        </p>
                        {doc.arquivo_nome && (
                          <p className="truncate text-xs text-muted-foreground">{doc.arquivo_nome}</p>
                        )}
                        {doc.observacao && (
                          <p className="mt-1 text-xs text-destructive">{doc.observacao}</p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          doc.status === "aprovado"
                            ? "border-emerald-500/40 text-emerald-500"
                            : doc.status === "reprovado"
                              ? "border-destructive/40 text-destructive"
                              : ""
                        }
                      >
                        {doc.status === "pendente"
                          ? "Pendente"
                          : doc.status === "enviado"
                            ? "Enviado"
                            : doc.status === "em_validacao"
                              ? "Em validação"
                              : doc.status === "aprovado"
                                ? "Aprovado"
                                : "Reenviar"}
                      </Badge>
                    </div>
                    <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border py-3 text-sm text-muted-foreground hover:border-gold/50">
                      {enviandoId === doc.id ? (
                        "Enviando..."
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          {doc.arquivo_nome ? "Enviar outro arquivo" : "Escolher arquivo"}
                        </>
                      )}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,application/pdf"
                        disabled={upload.isPending}
                        onChange={(ev) => {
                          const file = ev.target.files?.[0];
                          ev.target.value = "";
                          if (!file) return;
                          setEnviandoId(doc.id);
                          upload.mutate({ documentoId: doc.id, file });
                        }}
                      />
                    </label>
                  </div>
                ))}
                {obrigatoriosPendentes > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Faltam {obrigatoriosPendentes} documento(s) obrigatório(s) para avançar.
                  </p>
                )}
              </section>
            )}

            {etapaAtual === "transporte" && (
              <section className="mt-6 space-y-4">
                <h2 className="text-base font-semibold text-foreground">Transporte</h2>
                <div>
                  <Label>Como você vai se deslocar?</Label>
                  <Select
                    value={modalidade}
                    onValueChange={(v) => setModalidade(v as typeof modalidade)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vt">Vale-transporte (VT)</SelectItem>
                      <SelectItem value="vc">Vale-combustível (VC)</SelectItem>
                      <SelectItem value="proprio">Transporte próprio</SelectItem>
                      <SelectItem value="nenhum">Não utilizarei</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {modalidade === "vt" && (
                  <div>
                    <Label htmlFor="linhas">Linhas/itinerário que você utiliza</Label>
                    <Textarea
                      id="linhas"
                      className="mt-1"
                      rows={3}
                      value={linhas}
                      onChange={(e) => setLinhas(e.target.value)}
                    />
                  </div>
                )}
                {(modalidade === "vc" || modalidade === "proprio") && (
                  <div>
                    <Label htmlFor="placa">Placa do veículo</Label>
                    <Input
                      id="placa"
                      className="mt-1"
                      value={placa}
                      onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                    />
                  </div>
                )}
                <Button
                  className="w-full bg-gradient-gold font-semibold shadow-gold"
                  disabled={transporteMut.isPending}
                  onClick={() => transporteMut.mutate()}
                >
                  Salvar informações
                </Button>
              </section>
            )}

            {etapaAtual === "treinamentos" && (
              <section className="mt-6 space-y-3">
                <h2 className="text-base font-semibold text-foreground">Treinamentos obrigatórios</h2>
                {treinamentos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum treinamento foi definido para o seu cargo. Você já pode avançar.
                  </p>
                ) : (
                  treinamentos.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {t.nr_codigo} — {t.nome}
                        </p>
                        {t.instrutor && (
                          <p className="text-xs text-muted-foreground">Instrutor: {t.instrutor}</p>
                        )}
                      </div>
                      {t.concluido_em ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Badge variant="outline">A realizar</Badge>
                      )}
                    </div>
                  ))
                )}
                <p className="text-xs text-muted-foreground">
                  O RH registra a conclusão dos treinamentos após a realização.
                </p>
              </section>
            )}

            {etapaAtual === "contrato" && (
              <section className="mt-6 space-y-4">
                <h2 className="text-base font-semibold text-foreground">Contrato</h2>
                <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  Confirmo que as informações e documentos enviados são verdadeiros e concordo com os
                  termos da minha contratação para o cargo de{" "}
                  <strong className="text-foreground">{admissao.cargo ?? "—"}</strong>.
                </div>
                <div>
                  <Label htmlFor="assinatura">Digite seu nome completo para assinar</Label>
                  <Input
                    id="assinatura"
                    className="mt-1"
                    value={assinatura}
                    onChange={(e) => setAssinatura(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full bg-gradient-gold font-semibold shadow-gold"
                  disabled={contratoMut.isPending || assinatura.trim().length < 5}
                  onClick={() => contratoMut.mutate()}
                >
                  Aceitar e concluir admissão
                </Button>
                {contrato?.aceito_em && (
                  <p className="text-xs text-muted-foreground">
                    Aceite registrado anteriormente por {contrato.assinatura_nome}.
                  </p>
                )}
              </section>
            )}

            <div className="mt-8 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={indice <= 0 || etapaMut.isPending}
                onClick={() => etapaMut.mutate(ETAPAS[indice - 1]!)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
              <Button
                className="flex-1 bg-gradient-gold font-semibold shadow-gold"
                disabled={
                  indice >= 3 ||
                  etapaMut.isPending ||
                  (etapaAtual === "documentos" && obrigatoriosPendentes > 0)
                }
                onClick={() => etapaMut.mutate(ETAPAS[indice + 1]!)}
              >
                Avançar <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Seu progresso é salvo automaticamente. Você pode fechar e continuar depois pelo mesmo link.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
