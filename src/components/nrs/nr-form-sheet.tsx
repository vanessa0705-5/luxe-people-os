import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileUp, Loader2, ScanLine } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listColaboradores } from "@/lib/colaboradores-api";
import { arquivoParaBase64 } from "@/lib/importacao-api";
import { extrairRegistrosImportacao } from "@/lib/importacao.functions";
import { onlyDigits } from "@/lib/br-format";
import { listEmpresasPaged } from "@/lib/empresas-api";
import {
  createTreinamento,
  listNrsCatalogo,
  somarMeses,
  updateTreinamento,
  uploadDocumentoSst,
  type NrTreinamentoComRelacoes,
} from "@/lib/nrs-api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registro?: NrTreinamentoComRelacoes | null;
  colaboradorIdFixo?: string;
}

interface FormState {
  colaborador_id: string;
  empresa_id: string;
  nr_codigo: string;
  nome_treinamento: string;
  data_realizacao: string;
  data_validade: string;
  carga_horaria: string;
  instrutor: string;
  cargo: string;
  unidade: string;
  observacoes: string;
}

const EMPTY: FormState = {
  colaborador_id: "",
  empresa_id: "",
  nr_codigo: "",
  nome_treinamento: "",
  data_realizacao: "",
  data_validade: "",
  carga_horaria: "",
  instrutor: "",
  cargo: "",
  unidade: "",
  observacoes: "",
};

export function NrFormSheet({ open, onOpenChange, registro, colaboradorIdFixo }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [lendoArquivo, setLendoArquivo] = useState(false);
  const extrair = useServerFn(extrairRegistrosImportacao);

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores", "select-nr"],
    queryFn: () => listColaboradores({ status: "todos" }),
    enabled: open,
  });

  const { data: catalogo = [] } = useQuery({
    queryKey: ["nrs-catalogo"],
    queryFn: listNrsCatalogo,
    enabled: open,
  });

  const { data: empresas } = useQuery({
    queryKey: ["empresas", "select-nr"],
    queryFn: () => listEmpresasPaged({ status: "ativa", page: 1, pageSize: 500 }),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setArquivo(null);
    if (registro) {
      setForm({
        colaborador_id: registro.colaborador_id,
        empresa_id: registro.empresa_id ?? "",
        nr_codigo: registro.nr_codigo,
        nome_treinamento: registro.nome_treinamento,
        data_realizacao: registro.data_realizacao,
        data_validade: registro.data_validade ?? "",
        carga_horaria: registro.carga_horaria != null ? String(registro.carga_horaria) : "",
        instrutor: registro.instrutor ?? "",
        cargo: registro.cargo ?? "",
        unidade: registro.unidade ?? "",
        observacoes: registro.observacoes ?? "",
      });
    } else {
      setForm({ ...EMPTY, colaborador_id: colaboradorIdFixo ?? "" });
    }
  }, [open, registro, colaboradorIdFixo]);

  const colaboradorSelecionado = useMemo(
    () => colaboradores.find((c) => c.id === form.colaborador_id) ?? null,
    [colaboradores, form.colaborador_id],
  );

  const nrSelecionada = useMemo(
    () => catalogo.find((n) => n.codigo === form.nr_codigo) ?? null,
    [catalogo, form.nr_codigo],
  );

  useEffect(() => {
    if (!open || registro || !colaboradorSelecionado) return;
    setForm((f) => ({
      ...f,
      cargo: f.cargo || colaboradorSelecionado.cargo || "",
      unidade: f.unidade || colaboradorSelecionado.unidade || "",
    }));
  }, [open, registro, colaboradorSelecionado]);

  // Preenche nome e validade a partir do catálogo de NRs.
  useEffect(() => {
    if (!open || !nrSelecionada) return;
    setForm((f) => ({
      ...f,
      nome_treinamento: f.nome_treinamento || nrSelecionada.nome,
      data_validade:
        f.data_validade || !f.data_realizacao
          ? f.data_validade
          : somarMeses(f.data_realizacao, nrSelecionada.validade_meses),
    }));
  }, [open, nrSelecionada, form.data_realizacao]);

  /** Lê o certificado anexado com IA e preenche os campos, inclusive a validade. */
  async function lerDocumento(file: File) {
    setLendoArquivo(true);
    try {
      const resultado = await extrair({
        data: {
          modulo: "nrs",
          arquivo: {
            nome: file.name,
            mime: file.type || "application/pdf",
            base64: await arquivoParaBase64(file),
          },
        },
      });
      const r = (resultado.registros ?? [])[0] as Record<string, unknown> | undefined;
      if (!r) {
        toast.error("Não foi possível identificar os dados do treinamento no documento.");
        return;
      }
      const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
      const cpfDoc = onlyDigits(str(r.colaborador_cpf));
      const nomeDoc = str(r.colaborador_nome).toLowerCase();
      const encontrado = colaboradores.find(
        (c) =>
          (cpfDoc && onlyDigits(c.cpf) === cpfDoc) ||
          (nomeDoc && c.nome_completo.toLowerCase() === nomeDoc),
      );
      const digitos = onlyDigits(str(r.nr_codigo));
      const codigo = digitos ? `NR-${digitos.padStart(2, "0")}` : "";
      const doCatalogo = catalogo.find((n) => n.codigo === codigo) ?? null;
      const realizacao = str(r.data_realizacao).slice(0, 10);
      const validadeDoc = str(r.data_validade).slice(0, 10);
      const mesesDoc = Number(r.validade_meses);
      const meses = Number.isFinite(mesesDoc) && mesesDoc > 0
        ? mesesDoc
        : (doCatalogo?.validade_meses ?? 0);
      const cargaDoc = Number(r.carga_horaria);

      setForm((f) => {
        const dataRealizacao = realizacao || f.data_realizacao;
        let validade = validadeDoc || "";
        if (!validade && dataRealizacao && meses > 0) validade = somarMeses(dataRealizacao, meses);
        return {
          ...f,
          colaborador_id: colaboradorIdFixo ?? encontrado?.id ?? f.colaborador_id,
          nr_codigo: doCatalogo?.codigo ?? f.nr_codigo,
          nome_treinamento: str(r.nome_treinamento) || doCatalogo?.nome || f.nome_treinamento,
          data_realizacao: dataRealizacao,
          data_validade: validade || f.data_validade,
          carga_horaria:
            Number.isFinite(cargaDoc) && cargaDoc > 0 ? String(cargaDoc) : f.carga_horaria,
          instrutor: str(r.instrutor) || f.instrutor,
          cargo: str(r.cargo) || f.cargo,
          unidade: str(r.unidade) || f.unidade,
        };
      });
      if (codigo && !doCatalogo) {
        toast.warning(`Dados lidos. A norma ${codigo} não está no catálogo: selecione a NR.`);
      } else if (cpfDoc && !encontrado) {
        toast.warning("Dados lidos. Selecione o colaborador manualmente: não localizamos o CPF.");
      } else {
        toast.success("Certificado lido. Confira os dados e a validade antes de salvar.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao ler o documento.");
    } finally {
      setLendoArquivo(false);
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      let certificado_path = registro?.certificado_path ?? null;
      let certificado_nome = registro?.certificado_nome ?? null;
      if (arquivo) {
        const enviado = await uploadDocumentoSst(arquivo, "nrs");
        certificado_path = enviado.path;
        certificado_nome = enviado.nome;
      }
      const payload = {
        colaborador_id: form.colaborador_id,
        empresa_id: form.empresa_id || null,
        nr_codigo: form.nr_codigo,
        nome_treinamento: form.nome_treinamento.trim(),
        data_realizacao: form.data_realizacao,
        data_validade: form.data_validade || null,
        carga_horaria: form.carga_horaria ? Number(form.carga_horaria) : null,
        instrutor: form.instrutor.trim() || null,
        cargo: form.cargo.trim() || null,
        unidade: form.unidade.trim() || null,
        observacoes: form.observacoes.trim() || null,
        certificado_path,
        certificado_nome,
      };
      if (registro) return updateTreinamento(registro.id, payload);
      return createTreinamento(payload);
    },
    onSuccess: () => {
      toast.success(
        registro ? "Treinamento atualizado com sucesso." : "Treinamento registrado com sucesso.",
      );
      queryClient.invalidateQueries({ queryKey: ["nr-treinamentos"] });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar o treinamento.");
    },
  });

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (!form.colaborador_id) e.colaborador_id = "Selecione o colaborador.";
    if (!form.nr_codigo) e.nr_codigo = "Selecione a norma regulamentadora.";
    if (!form.nome_treinamento.trim()) e.nome_treinamento = "Informe o nome do treinamento.";
    if (!form.data_realizacao) e.data_realizacao = "Informe a data de realização.";
    if (form.data_validade && form.data_realizacao && form.data_validade < form.data_realizacao)
      e.data_validade = "A validade deve ser posterior à realização.";
    if (form.carga_horaria && Number(form.carga_horaria) <= 0)
      e.carga_horaria = "Informe uma carga horária válida.";
    if (arquivo && arquivo.size > 20 * 1024 * 1024)
      e.arquivo = "O arquivo deve ter no máximo 20 MB.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validar()) return;
    mutation.mutate();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{registro ? "Editar treinamento" : "Novo treinamento de NR"}</SheetTitle>
          <SheetDescription>
            Registre o treinamento, a validade e anexe o certificado do colaborador.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          <div className="rounded-xl border border-dashed border-gold/45 bg-accent/25 p-4">
            <Label htmlFor="nr-arquivo">Certificado (PDF)</Label>
            <Input
              id="nr-arquivo"
              type="file"
              accept="application/pdf,image/*"
              aria-invalid={!!errors.arquivo}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setArquivo(file);
                if (file) void lerDocumento(file);
              }}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Ao anexar, o certificado é lido automaticamente e os campos, incluindo a validade, são
              preenchidos para sua conferência.
            </p>
            {arquivo && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={lendoArquivo}
                onClick={() => void lerDocumento(arquivo)}
              >
                {lendoArquivo ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Lendo certificado...
                  </>
                ) : (
                  <>
                    <ScanLine className="mr-2 h-4 w-4" /> Ler certificado novamente
                  </>
                )}
              </Button>
            )}
            {errors.arquivo ? (
              <p className="text-xs text-destructive">{errors.arquivo}</p>
            ) : arquivo ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-gold">
                <FileUp className="h-3.5 w-3.5" /> Certificado selecionado: {arquivo.name}
              </p>
            ) : registro?.certificado_nome && !arquivo ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileUp className="h-3.5 w-3.5" /> Anexo atual: {registro.certificado_nome}
              </p>
            ) : null}
          </div>


          <div className="flex flex-col gap-2">
            <Label htmlFor="nr-colaborador">Colaborador *</Label>
            <Select
              value={form.colaborador_id}
              onValueChange={(v) => setForm((f) => ({ ...f, colaborador_id: v }))}
              disabled={!!colaboradorIdFixo}
            >
              <SelectTrigger id="nr-colaborador" aria-invalid={!!errors.colaborador_id}>
                <SelectValue placeholder="Selecione o colaborador" />
              </SelectTrigger>
              <SelectContent>
                {colaboradores.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome_completo}
                    {c.matricula ? ` — ${c.matricula}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.colaborador_id && (
              <p className="text-xs text-destructive">{errors.colaborador_id}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="nr-codigo">Norma regulamentadora *</Label>
            <Select
              value={form.nr_codigo}
              onValueChange={(v) => setForm((f) => ({ ...f, nr_codigo: v, nome_treinamento: "" }))}
            >
              <SelectTrigger id="nr-codigo" aria-invalid={!!errors.nr_codigo}>
                <SelectValue placeholder="Selecione a NR" />
              </SelectTrigger>
              <SelectContent>
                {catalogo.map((n) => (
                  <SelectItem key={n.id} value={n.codigo}>
                    {n.codigo} — {n.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.nr_codigo ? (
              <p className="text-xs text-destructive">{errors.nr_codigo}</p>
            ) : nrSelecionada ? (
              <p className="text-xs text-muted-foreground">
                Validade padrão: {nrSelecionada.validade_meses} meses
                {nrSelecionada.obrigatoria ? " • Treinamento obrigatório" : ""}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="nr-nome">Nome do treinamento *</Label>
            <Input
              id="nr-nome"
              value={form.nome_treinamento}
              aria-invalid={!!errors.nome_treinamento}
              onChange={(e) => setForm((f) => ({ ...f, nome_treinamento: e.target.value }))}
            />
            {errors.nome_treinamento && (
              <p className="text-xs text-destructive">{errors.nome_treinamento}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nr-realizacao">Data de realização *</Label>
              <Input
                id="nr-realizacao"
                type="date"
                value={form.data_realizacao}
                aria-invalid={!!errors.data_realizacao}
                onChange={(e) => setForm((f) => ({ ...f, data_realizacao: e.target.value }))}
              />
              {errors.data_realizacao && (
                <p className="text-xs text-destructive">{errors.data_realizacao}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nr-validade">Validade</Label>
              <Input
                id="nr-validade"
                type="date"
                value={form.data_validade}
                aria-invalid={!!errors.data_validade}
                onChange={(e) => setForm((f) => ({ ...f, data_validade: e.target.value }))}
              />
              {errors.data_validade ? (
                <p className="text-xs text-destructive">{errors.data_validade}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Calculada pelo catálogo de NRs.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nr-carga">Carga horária (h)</Label>
              <Input
                id="nr-carga"
                type="number"
                min={1}
                value={form.carga_horaria}
                aria-invalid={!!errors.carga_horaria}
                onChange={(e) => setForm((f) => ({ ...f, carga_horaria: e.target.value }))}
              />
              {errors.carga_horaria && (
                <p className="text-xs text-destructive">{errors.carga_horaria}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nr-instrutor">Instrutor / entidade</Label>
              <Input
                id="nr-instrutor"
                value={form.instrutor}
                onChange={(e) => setForm((f) => ({ ...f, instrutor: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nr-cargo">Cargo</Label>
              <Input
                id="nr-cargo"
                value={form.cargo}
                onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nr-unidade">Unidade</Label>
              <Input
                id="nr-unidade"
                value={form.unidade}
                onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="nr-empresa">Empresa (CNPJ)</Label>
            <Select
              value={form.empresa_id || "nenhuma"}
              onValueChange={(v) => setForm((f) => ({ ...f, empresa_id: v === "nenhuma" ? "" : v }))}
            >
              <SelectTrigger id="nr-empresa">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Não vinculada</SelectItem>
                {(empresas?.rows ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome_fantasia || e.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="nr-obs">Observações</Label>
            <Textarea
              id="nr-obs"
              rows={3}
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
            />
          </div>

          <div className="flex flex-col-reverse gap-2 pb-6 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
            >
              {mutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {mutation.isPending
                ? "Salvando..."
                : registro
                  ? "Salvar alterações"
                  : "Registrar treinamento"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
