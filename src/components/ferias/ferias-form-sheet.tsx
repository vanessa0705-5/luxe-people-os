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
import { listColaboradores } from "@/lib/colaboradores-api";
import {
  STATUS_FERIAS_LABELS,
  STATUS_FERIAS_ORDER,
  calcularDias,
  createFerias,
  formatarData,
  periodoAquisitivoSugerido,
  updateFerias,
  type FeriasComColaborador,
  type StatusFerias,
} from "@/lib/ferias-api";

import { useAuth } from "@/lib/auth-context";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registro?: FeriasComColaborador | null;
  colaboradorIdFixo?: string;
}

interface FormState {
  colaborador_id: string;
  periodo_aquisitivo_inicio: string;
  periodo_aquisitivo_fim: string;
  data_inicio: string;
  data_fim: string;
  status: StatusFerias;
  observacoes: string;
}

const EMPTY: FormState = {
  colaborador_id: "",
  periodo_aquisitivo_inicio: "",
  periodo_aquisitivo_fim: "",
  data_inicio: "",
  data_fim: "",
  status: "solicitada",
  observacoes: "",
};

export function FeriasFormSheet({ open, onOpenChange, registro, colaboradorIdFixo }: Props) {
  const queryClient = useQueryClient();
  const { hasRole, isAdminPrincipal } = useAuth();
  const podeDefinirStatus = isAdminPrincipal || hasRole("rh");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores", "select-ferias"],
    queryFn: () => listColaboradores({ status: "todos" }),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (registro) {
      setForm({
        colaborador_id: registro.colaborador_id,
        periodo_aquisitivo_inicio: registro.periodo_aquisitivo_inicio ?? "",
        periodo_aquisitivo_fim: registro.periodo_aquisitivo_fim ?? "",
        data_inicio: registro.data_inicio,
        data_fim: registro.data_fim,
        status: registro.status,
        observacoes: registro.observacoes ?? "",
      });
    } else {
      setForm({ ...EMPTY, colaborador_id: colaboradorIdFixo ?? "" });
    }
  }, [open, registro, colaboradorIdFixo]);

  const dias = useMemo(() => calcularDias(form.data_inicio, form.data_fim), [form]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        colaborador_id: form.colaborador_id,
        periodo_aquisitivo_inicio: form.periodo_aquisitivo_inicio || null,
        periodo_aquisitivo_fim: form.periodo_aquisitivo_fim || null,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,
        dias,
        observacoes: form.observacoes.trim() || null,
        ...(podeDefinirStatus ? { status: form.status } : {}),
      };
      if (registro) return updateFerias(registro.id, payload);
      return createFerias(payload);
    },
    onSuccess: () => {
      toast.success(registro ? "Férias atualizadas com sucesso." : "Solicitação de férias registrada.");
      queryClient.invalidateQueries({ queryKey: ["ferias"] });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao salvar as férias.";
      toast.error(msg);
    },
  });

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (!form.colaborador_id) e.colaborador_id = "Selecione o colaborador.";
    if (!form.data_inicio) e.data_inicio = "Informe a data de início.";
    if (!form.data_fim) e.data_fim = "Informe a data de término.";
    if (form.data_inicio && form.data_fim && form.data_fim < form.data_inicio)
      e.data_fim = "A data de término não pode ser anterior ao início.";
    if (
      form.periodo_aquisitivo_inicio &&
      form.periodo_aquisitivo_fim &&
      form.periodo_aquisitivo_fim < form.periodo_aquisitivo_inicio
    )
      e.periodo_aquisitivo_fim = "O fim do período aquisitivo deve ser posterior ao início.";
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
          <SheetTitle>{registro ? "Editar férias" : "Nova solicitação de férias"}</SheetTitle>
          <SheetDescription>
            Informe o período de gozo e, opcionalmente, o período aquisitivo de referência.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="colaborador">Colaborador *</Label>
            <Select
              value={form.colaborador_id}
              onValueChange={(v) => setForm((f) => ({ ...f, colaborador_id: v }))}
              disabled={!!colaboradorIdFixo}
            >
              <SelectTrigger id="colaborador" aria-invalid={!!errors.colaborador_id}>
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
              <Label htmlFor="pa-inicio">Período aquisitivo (início)</Label>
              <Input
                id="pa-inicio"
                type="date"
                value={form.periodo_aquisitivo_inicio}
                onChange={(e) =>
                  setForm((f) => ({ ...f, periodo_aquisitivo_inicio: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pa-fim">Período aquisitivo (fim)</Label>
              <Input
                id="pa-fim"
                type="date"
                value={form.periodo_aquisitivo_fim}
                aria-invalid={!!errors.periodo_aquisitivo_fim}
                onChange={(e) => setForm((f) => ({ ...f, periodo_aquisitivo_fim: e.target.value }))}
              />
              {errors.periodo_aquisitivo_fim && (
                <p className="text-xs text-destructive">{errors.periodo_aquisitivo_fim}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="inicio">Início das férias *</Label>
              <Input
                id="inicio"
                type="date"
                value={form.data_inicio}
                aria-invalid={!!errors.data_inicio}
                onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value }))}
              />
              {errors.data_inicio && <p className="text-xs text-destructive">{errors.data_inicio}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fim">Término das férias *</Label>
              <Input
                id="fim"
                type="date"
                value={form.data_fim}
                aria-invalid={!!errors.data_fim}
                onChange={(e) => setForm((f) => ({ ...f, data_fim: e.target.value }))}
              />
              {errors.data_fim && <p className="text-xs text-destructive">{errors.data_fim}</p>}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-accent/40 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Total de dias: </span>
            <span className="font-semibold text-foreground">{dias}</span>
          </div>

          {podeDefinirStatus && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="status">Situação</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v as StatusFerias }))}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FERIAS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_FERIAS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="obs">Observações</Label>
            <Textarea
              id="obs"
              rows={3}
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              placeholder="Informações complementares sobre o período"
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
              {mutation.isPending ? "Salvando..." : registro ? "Salvar alterações" : "Registrar"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
