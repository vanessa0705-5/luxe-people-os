import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { listColaboradores, listTomadores, STATUS_LABELS } from "@/lib/colaboradores-api";
import {
  STATUS_SUGERIDO,
  TIPO_MOV_LABELS,
  TIPO_MOV_ORDER,
  createMovimentacao,
  formatarMoeda,
  updateMovimentacao,
  type MovimentacaoComColaborador,
  type StatusColaborador,
  type TipoMovimentacao,
} from "@/lib/movimentacoes-api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registro?: MovimentacaoComColaborador | null;
  colaboradorIdFixo?: string;
}

interface FormState {
  colaborador_id: string;
  tipo: TipoMovimentacao;
  data_efeito: string;
  cargo_novo: string;
  funcao_nova: string;
  salario_novo: string;
  departamento_novo: string;
  tomador_novo_id: string;
  coordenador_novo_id: string;
  status_novo: StatusColaborador | "manter";
  motivo: string;
  observacoes: string;
}

const HOJE = () => new Date().toISOString().slice(0, 10);

const EMPTY: FormState = {
  colaborador_id: "",
  tipo: "promocao",
  data_efeito: "",
  cargo_novo: "",
  funcao_nova: "",
  salario_novo: "",
  departamento_novo: "",
  tomador_novo_id: "",
  coordenador_novo_id: "",
  status_novo: "manter",
  motivo: "",
  observacoes: "",
};

const NENHUM = "__nenhum__";

function mostraCampos(tipo: TipoMovimentacao) {
  return {
    cargo: tipo === "promocao" || tipo === "transferencia" || tipo === "admissao",
    salario: tipo === "promocao" || tipo === "alteracao_salarial" || tipo === "admissao",
    lotacao: tipo === "transferencia" || tipo === "admissao",
    situacao: tipo === "afastamento" || tipo === "retorno" || tipo === "desligamento",
  };
}

export function MovimentacaoFormSheet({
  open,
  onOpenChange,
  registro,
  colaboradorIdFixo,
}: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores", "select-movimentacoes"],
    queryFn: () => listColaboradores({ status: "todos" }),
    enabled: open,
  });

  const { data: tomadores = [] } = useQuery({
    queryKey: ["tomadores", "select-movimentacoes"],
    queryFn: listTomadores,
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (registro) {
      setForm({
        colaborador_id: registro.colaborador_id,
        tipo: registro.tipo,
        data_efeito: registro.data_efeito,
        cargo_novo: registro.cargo_novo ?? "",
        funcao_nova: registro.funcao_nova ?? "",
        salario_novo: registro.salario_novo !== null ? String(registro.salario_novo) : "",
        departamento_novo: registro.departamento_novo ?? "",
        tomador_novo_id: registro.tomador_novo_id ?? "",
        coordenador_novo_id: registro.coordenador_novo_id ?? "",
        status_novo: registro.status_novo ?? "manter",
        motivo: registro.motivo ?? "",
        observacoes: registro.observacoes ?? "",
      });
    } else {
      setForm({
        ...EMPTY,
        colaborador_id: colaboradorIdFixo ?? "",
        data_efeito: HOJE(),
      });
    }
  }, [open, registro, colaboradorIdFixo]);

  const colaboradorAtual = useMemo(
    () => colaboradores.find((c) => c.id === form.colaborador_id) ?? null,
    [colaboradores, form.colaborador_id],
  );

  const campos = mostraCampos(form.tipo);

  function alterarTipo(tipo: TipoMovimentacao) {
    setForm((f) => ({
      ...f,
      tipo,
      status_novo: STATUS_SUGERIDO[tipo] ?? "manter",
    }));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const salario = form.salario_novo.replace(/\./g, "").replace(",", ".");
      const payload = {
        colaborador_id: form.colaborador_id,
        tipo: form.tipo,
        data_efeito: form.data_efeito,
        cargo_novo: campos.cargo ? form.cargo_novo.trim() || null : null,
        funcao_nova: campos.cargo ? form.funcao_nova.trim() || null : null,
        salario_novo: campos.salario && salario ? Number(salario) : null,
        departamento_novo: campos.lotacao ? form.departamento_novo.trim() || null : null,
        tomador_novo_id: campos.lotacao ? form.tomador_novo_id || null : null,
        coordenador_novo_id: campos.lotacao ? form.coordenador_novo_id || null : null,
        status_novo: form.status_novo === "manter" ? null : form.status_novo,
        motivo: form.motivo.trim() || null,
        observacoes: form.observacoes.trim() || null,
      };
      if (registro) return updateMovimentacao(registro.id, payload);
      return createMovimentacao(payload);
    },
    onSuccess: () => {
      toast.success(
        registro ? "Movimentação atualizada com sucesso." : "Movimentação registrada com sucesso.",
      );
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
      queryClient.invalidateQueries({ queryKey: ["colaborador"] });
      onOpenChange(false);
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Erro ao salvar a movimentação."),
  });

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (!form.colaborador_id) e.colaborador_id = "Selecione o colaborador.";
    if (!form.data_efeito) e.data_efeito = "Informe a data de efeito.";
    const salario = form.salario_novo.replace(/\./g, "").replace(",", ".");
    if (form.salario_novo && (Number.isNaN(Number(salario)) || Number(salario) < 0))
      e.salario_novo = "Informe um valor válido.";
    if (form.tipo === "promocao" && !form.cargo_novo.trim() && !form.salario_novo)
      e.cargo_novo = "Informe o novo cargo ou o novo salário.";
    if (
      form.tipo === "transferencia" &&
      !form.departamento_novo.trim() &&
      !form.tomador_novo_id &&
      !form.coordenador_novo_id
    )
      e.departamento_novo = "Informe o novo departamento, tomador ou coordenador.";
    if (form.tipo === "alteracao_salarial" && !form.salario_novo)
      e.salario_novo = "Informe o novo salário.";
    if (form.tipo === "desligamento" && !form.motivo.trim())
      e.motivo = "Informe o motivo do desligamento.";
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
          <SheetTitle>{registro ? "Editar movimentação" : "Nova movimentação"}</SheetTitle>
          <SheetDescription>
            Ao salvar, a ficha do colaborador é atualizada automaticamente com os novos valores
            informados. Os valores anteriores ficam registrados no histórico.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="mov-colaborador">Colaborador *</Label>
            <Select
              value={form.colaborador_id}
              onValueChange={(v) => setForm((f) => ({ ...f, colaborador_id: v }))}
              disabled={!!colaboradorIdFixo || !!registro}
            >
              <SelectTrigger id="mov-colaborador" aria-invalid={!!errors.colaborador_id}>
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
              <Label htmlFor="mov-tipo">Tipo de movimentação *</Label>
              <Select value={form.tipo} onValueChange={(v) => alterarTipo(v as TipoMovimentacao)}>
                <SelectTrigger id="mov-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_MOV_ORDER.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_MOV_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="mov-data">Data de efeito *</Label>
              <Input
                id="mov-data"
                type="date"
                value={form.data_efeito}
                aria-invalid={!!errors.data_efeito}
                onChange={(e) => setForm((f) => ({ ...f, data_efeito: e.target.value }))}
              />
              {errors.data_efeito && (
                <p className="text-xs text-destructive">{errors.data_efeito}</p>
              )}
            </div>
          </div>

          {colaboradorAtual && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Situação atual</p>
              <p>Cargo: {colaboradorAtual.cargo ?? "—"}</p>
              <p>Função: {colaboradorAtual.funcao ?? "—"}</p>
              <p>Salário: {formatarMoeda(colaboradorAtual.salario)}</p>
              <p>Departamento: {colaboradorAtual.departamento ?? "—"}</p>
              <p>Tomador: {colaboradorAtual.tomador?.razao_social ?? "—"}</p>
              <p>Situação: {STATUS_LABELS[colaboradorAtual.status]}</p>
            </div>
          )}

          {campos.cargo && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="mov-cargo">Novo cargo</Label>
                <Input
                  id="mov-cargo"
                  value={form.cargo_novo}
                  aria-invalid={!!errors.cargo_novo}
                  placeholder="Deixe vazio para manter"
                  onChange={(e) => setForm((f) => ({ ...f, cargo_novo: e.target.value }))}
                />
                {errors.cargo_novo && (
                  <p className="text-xs text-destructive">{errors.cargo_novo}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="mov-funcao">Nova função</Label>
                <Input
                  id="mov-funcao"
                  value={form.funcao_nova}
                  placeholder="Deixe vazio para manter"
                  onChange={(e) => setForm((f) => ({ ...f, funcao_nova: e.target.value }))}
                />
              </div>
            </div>
          )}

          {campos.salario && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="mov-salario">Novo salário (R$)</Label>
              <Input
                id="mov-salario"
                inputMode="decimal"
                value={form.salario_novo}
                aria-invalid={!!errors.salario_novo}
                placeholder="Ex.: 3500,00"
                onChange={(e) => setForm((f) => ({ ...f, salario_novo: e.target.value }))}
              />
              {errors.salario_novo && (
                <p className="text-xs text-destructive">{errors.salario_novo}</p>
              )}
            </div>
          )}

          {campos.lotacao && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="mov-dep">Novo departamento</Label>
                <Input
                  id="mov-dep"
                  value={form.departamento_novo}
                  aria-invalid={!!errors.departamento_novo}
                  placeholder="Deixe vazio para manter"
                  onChange={(e) => setForm((f) => ({ ...f, departamento_novo: e.target.value }))}
                />
                {errors.departamento_novo && (
                  <p className="text-xs text-destructive">{errors.departamento_novo}</p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="mov-tomador">Novo tomador</Label>
                  <Select
                    value={form.tomador_novo_id || NENHUM}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, tomador_novo_id: v === NENHUM ? "" : v }))
                    }
                  >
                    <SelectTrigger id="mov-tomador">
                      <SelectValue placeholder="Manter atual" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NENHUM}>Manter atual</SelectItem>
                      {tomadores.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.razao_social}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="mov-coord">Novo coordenador</Label>
                  <Select
                    value={form.coordenador_novo_id || NENHUM}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, coordenador_novo_id: v === NENHUM ? "" : v }))
                    }
                  >
                    <SelectTrigger id="mov-coord">
                      <SelectValue placeholder="Manter atual" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NENHUM}>Manter atual</SelectItem>
                      {colaboradores
                        .filter((c) => c.id !== form.colaborador_id)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome_completo}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="mov-status">
              Nova situação do colaborador{campos.situacao ? " *" : ""}
            </Label>
            <Select
              value={form.status_novo}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, status_novo: v as StatusColaborador | "manter" }))
              }
            >
              <SelectTrigger id="mov-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manter">Manter situação atual</SelectItem>
                {(Object.keys(STATUS_LABELS) as StatusColaborador[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="mov-motivo">Motivo{form.tipo === "desligamento" ? " *" : ""}</Label>
            <Input
              id="mov-motivo"
              value={form.motivo}
              aria-invalid={!!errors.motivo}
              onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
            />
            {errors.motivo && <p className="text-xs text-destructive">{errors.motivo}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="mov-obs">Observações</Label>
            <Textarea
              id="mov-obs"
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
              {mutation.isPending ? "Salvando..." : "Salvar movimentação"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
