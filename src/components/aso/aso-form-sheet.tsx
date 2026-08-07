import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileUp, Loader2 } from "lucide-react";
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
import { listEmpresasPaged } from "@/lib/empresas-api";
import {
  RESULTADO_LABELS,
  RESULTADO_ORDER,
  TIPO_EXAME_LABELS,
  TIPO_EXAME_ORDER,
  VALIDADE_PADRAO_MESES,
  createAso,
  somarMeses,
  updateAso,
  uploadDocumentoSst,
  type AsoComRelacoes,
  type ResultadoAso,
  type TipoExameAso,
} from "@/lib/aso-api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registro?: AsoComRelacoes | null;
  colaboradorIdFixo?: string;
}

interface FormState {
  colaborador_id: string;
  empresa_id: string;
  tipo_exame: TipoExameAso;
  data_exame: string;
  data_vencimento: string;
  resultado: ResultadoAso | "";
  clinica: string;
  medico_responsavel: string;
  crm: string;
  cargo: string;
  unidade: string;
  observacoes: string;
}

const EMPTY: FormState = {
  colaborador_id: "",
  empresa_id: "",
  tipo_exame: "admissional",
  data_exame: "",
  data_vencimento: "",
  resultado: "",
  clinica: "",
  medico_responsavel: "",
  crm: "",
  cargo: "",
  unidade: "",
  observacoes: "",
};

export function AsoFormSheet({ open, onOpenChange, registro, colaboradorIdFixo }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [arquivo, setArquivo] = useState<File | null>(null);

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores", "select-aso"],
    queryFn: () => listColaboradores({ status: "todos" }),
    enabled: open,
  });

  const { data: empresas } = useQuery({
    queryKey: ["empresas", "select-aso"],
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
        tipo_exame: registro.tipo_exame,
        data_exame: registro.data_exame,
        data_vencimento: registro.data_vencimento ?? "",
        resultado: registro.resultado ?? "",
        clinica: registro.clinica ?? "",
        medico_responsavel: registro.medico_responsavel ?? "",
        crm: registro.crm ?? "",
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

  // Preenche cargo/unidade a partir do cadastro do colaborador.
  useEffect(() => {
    if (!open || registro || !colaboradorSelecionado) return;
    setForm((f) => ({
      ...f,
      cargo: f.cargo || colaboradorSelecionado.cargo || "",
      unidade: f.unidade || colaboradorSelecionado.unidade || "",
    }));
  }, [open, registro, colaboradorSelecionado]);

  // Sugere o vencimento com base no tipo de exame e na data de realização.
  useEffect(() => {
    if (!open || !form.data_exame) return;
    if (form.tipo_exame === "demissional") return;
    setForm((f) =>
      f.data_vencimento
        ? f
        : { ...f, data_vencimento: somarMeses(f.data_exame, VALIDADE_PADRAO_MESES) },
    );
  }, [open, form.data_exame, form.tipo_exame]);

  const mutation = useMutation({
    mutationFn: async () => {
      let arquivo_path = registro?.arquivo_path ?? null;
      let arquivo_nome = registro?.arquivo_nome ?? null;
      if (arquivo) {
        const enviado = await uploadDocumentoSst(arquivo, "aso");
        arquivo_path = enviado.path;
        arquivo_nome = enviado.nome;
      }
      const payload = {
        colaborador_id: form.colaborador_id,
        empresa_id: form.empresa_id || null,
        tipo_exame: form.tipo_exame,
        data_exame: form.data_exame,
        data_vencimento: form.data_vencimento || null,
        resultado: form.resultado || null,
        clinica: form.clinica.trim() || null,
        medico_responsavel: form.medico_responsavel.trim() || null,
        crm: form.crm.trim() || null,
        cargo: form.cargo.trim() || null,
        unidade: form.unidade.trim() || null,
        matricula: colaboradorSelecionado?.matricula ?? null,
        cpf: colaboradorSelecionado?.cpf ?? null,
        observacoes: form.observacoes.trim() || null,
        arquivo_path,
        arquivo_nome,
      };
      if (registro) return updateAso(registro.id, payload);
      return createAso(payload);
    },
    onSuccess: () => {
      toast.success(registro ? "ASO atualizado com sucesso." : "ASO registrado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["asos"] });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar o ASO.");
    },
  });

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (!form.colaborador_id) e.colaborador_id = "Selecione o colaborador.";
    if (!form.data_exame) e.data_exame = "Informe a data do exame.";
    if (form.data_vencimento && form.data_exame && form.data_vencimento < form.data_exame)
      e.data_vencimento = "O vencimento deve ser posterior à data do exame.";
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
          <SheetTitle>{registro ? "Editar ASO" : "Novo ASO"}</SheetTitle>
          <SheetDescription>
            Registre o Atestado de Saúde Ocupacional, o resultado e anexe o documento em PDF.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="aso-colaborador">Colaborador *</Label>
            <Select
              value={form.colaborador_id}
              onValueChange={(v) => setForm((f) => ({ ...f, colaborador_id: v }))}
              disabled={!!colaboradorIdFixo}
            >
              <SelectTrigger id="aso-colaborador" aria-invalid={!!errors.colaborador_id}>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="aso-tipo">Tipo de exame *</Label>
              <Select
                value={form.tipo_exame}
                onValueChange={(v) => setForm((f) => ({ ...f, tipo_exame: v as TipoExameAso }))}
              >
                <SelectTrigger id="aso-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_EXAME_ORDER.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_EXAME_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="aso-resultado">Resultado</Label>
              <Select
                value={form.resultado || "nao_informado"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    resultado: v === "nao_informado" ? "" : (v as ResultadoAso),
                  }))
                }
              >
                <SelectTrigger id="aso-resultado">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_informado">Não informado</SelectItem>
                  {RESULTADO_ORDER.map((r) => (
                    <SelectItem key={r} value={r}>
                      {RESULTADO_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="aso-data">Data do exame *</Label>
              <Input
                id="aso-data"
                type="date"
                value={form.data_exame}
                aria-invalid={!!errors.data_exame}
                onChange={(e) => setForm((f) => ({ ...f, data_exame: e.target.value }))}
              />
              {errors.data_exame && <p className="text-xs text-destructive">{errors.data_exame}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="aso-venc">Vencimento</Label>
              <Input
                id="aso-venc"
                type="date"
                value={form.data_vencimento}
                aria-invalid={!!errors.data_vencimento}
                onChange={(e) => setForm((f) => ({ ...f, data_vencimento: e.target.value }))}
              />
              {errors.data_vencimento ? (
                <p className="text-xs text-destructive">{errors.data_vencimento}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sugerido automaticamente ({VALIDADE_PADRAO_MESES} meses).
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="aso-clinica">Clínica</Label>
              <Input
                id="aso-clinica"
                value={form.clinica}
                onChange={(e) => setForm((f) => ({ ...f, clinica: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="aso-empresa">Empresa (CNPJ)</Label>
              <Select
                value={form.empresa_id || "nenhuma"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, empresa_id: v === "nenhuma" ? "" : v }))
                }
              >
                <SelectTrigger id="aso-empresa">
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
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="aso-medico">Médico responsável</Label>
              <Input
                id="aso-medico"
                value={form.medico_responsavel}
                onChange={(e) => setForm((f) => ({ ...f, medico_responsavel: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="aso-crm">CRM</Label>
              <Input
                id="aso-crm"
                value={form.crm}
                onChange={(e) => setForm((f) => ({ ...f, crm: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="aso-cargo">Cargo no exame</Label>
              <Input
                id="aso-cargo"
                value={form.cargo}
                onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="aso-unidade">Unidade</Label>
              <Input
                id="aso-unidade"
                value={form.unidade}
                onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="aso-arquivo">Documento do ASO (PDF)</Label>
            <Input
              id="aso-arquivo"
              type="file"
              accept="application/pdf,image/*"
              aria-invalid={!!errors.arquivo}
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
            {errors.arquivo ? (
              <p className="text-xs text-destructive">{errors.arquivo}</p>
            ) : registro?.arquivo_nome && !arquivo ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileUp className="h-3.5 w-3.5" /> Anexo atual: {registro.arquivo_nome}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="aso-obs">Observações</Label>
            <Textarea
              id="aso-obs"
              rows={3}
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              placeholder="Restrições, recomendações médicas ou anotações internas"
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
              {mutation.isPending ? "Salvando..." : registro ? "Salvar alterações" : "Registrar ASO"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
