import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
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
import { listEmpresas } from "@/lib/empresas-api";
import { listTomadores } from "@/lib/colaboradores-api";
import { createAdmissao, updateAdmissao, type AdmissaoComRelacoes } from "@/lib/admissao-api";
import { isValidEmail, isValidTelefone, maskTelefone, onlyDigits } from "@/lib/br-format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admissao?: AdmissaoComRelacoes | null;
}

const NENHUM = "__nenhum__";

interface FormState {
  nome_completo: string;
  cpf: string;
  email: string;
  telefone: string;
  empresa_id: string;
  tomador_id: string;
  unidade: string;
  cargo: string;
  data_prevista: string;
  tipo_contrato: string;
  jornada_semanal: string;
  salario: string;
  observacoes: string;
}

const VAZIO: FormState = {
  nome_completo: "",
  cpf: "",
  email: "",
  telefone: "",
  empresa_id: NENHUM,
  tomador_id: NENHUM,
  unidade: "",
  cargo: "",
  data_prevista: "",
  tipo_contrato: "clt",
  jornada_semanal: "",
  salario: "",
  observacoes: "",
};

function maskCpf(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function AdmissaoFormSheet({ open, onOpenChange, admissao }: Props) {
  const [form, setForm] = useState<FormState>(VAZIO);
  const [erros, setErros] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const { data: empresas } = useQuery({ queryKey: ["empresas-lista"], queryFn: () => listEmpresas() });
  const { data: tomadores } = useQuery({ queryKey: ["tomadores-lista"], queryFn: listTomadores });

  useEffect(() => {
    if (!open) return;
    if (admissao) {
      setForm({
        nome_completo: admissao.nome_completo,
        cpf: maskCpf(admissao.cpf),
        email: admissao.email ?? "",
        telefone: admissao.telefone ? maskTelefone(admissao.telefone) : "",
        empresa_id: admissao.empresa_id ?? NENHUM,
        tomador_id: admissao.tomador_id ?? NENHUM,
        unidade: admissao.unidade ?? "",
        cargo: admissao.cargo ?? "",
        data_prevista: admissao.data_prevista ?? "",
        tipo_contrato: admissao.tipo_contrato ?? "clt",
        jornada_semanal: admissao.jornada_semanal?.toString() ?? "",
        salario: admissao.salario?.toString() ?? "",
        observacoes: admissao.observacoes ?? "",
      });
    } else {
      setForm(VAZIO);
    }
    setErros({});
  }, [open, admissao]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (form.nome_completo.trim().length < 5) e.nome_completo = "Informe o nome completo.";
    if (onlyDigits(form.cpf).length !== 11) e.cpf = "CPF deve ter 11 dígitos.";
    if (form.email && !isValidEmail(form.email)) e.email = "E-mail inválido.";
    if (form.telefone && !isValidTelefone(form.telefone)) e.telefone = "Telefone inválido.";
    if (!form.cargo.trim()) e.cargo = "Informe o cargo.";
    setErros(e);
    return Object.keys(e).length === 0;
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nome_completo: form.nome_completo.trim(),
        cpf: onlyDigits(form.cpf),
        email: form.email.trim() || null,
        telefone: form.telefone ? onlyDigits(form.telefone) : null,
        empresa_id: form.empresa_id === NENHUM ? null : form.empresa_id,
        tomador_id: form.tomador_id === NENHUM ? null : form.tomador_id,
        unidade: form.unidade.trim() || null,
        cargo: form.cargo.trim() || null,
        data_prevista: form.data_prevista || null,
        tipo_contrato: (form.tipo_contrato || null) as never,
        jornada_semanal: form.jornada_semanal ? Number(form.jornada_semanal) : null,
        salario: form.salario ? Number(form.salario.replace(",", ".")) : null,
        observacoes: form.observacoes.trim() || null,
      };
      if (admissao) return updateAdmissao(admissao.id, payload);
      return createAdmissao(payload);
    },
    onSuccess: () => {
      toast.success(admissao ? "Admissão atualizada." : "Admissão criada e link gerado.");
      queryClient.invalidateQueries({ queryKey: ["admissoes"] });
      queryClient.invalidateQueries({ queryKey: ["admissoes-resumo"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível salvar."),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{admissao ? "Editar admissão" : "Nova admissão"}</SheetTitle>
          <SheetDescription>
            Os dados abaixo iniciam o processo e geram o link exclusivo do candidato.
          </SheetDescription>
        </SheetHeader>

        <form
          className="mt-6 grid gap-4 sm:grid-cols-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (validar()) mutation.mutate();
          }}
        >
          <div className="sm:col-span-2">
            <Label htmlFor="nome">Nome completo *</Label>
            <Input
              id="nome"
              value={form.nome_completo}
              onChange={(e) => set("nome_completo", e.target.value)}
              aria-invalid={!!erros.nome_completo}
            />
            {erros.nome_completo && <p className="mt-1 text-xs text-destructive">{erros.nome_completo}</p>}
          </div>

          <div>
            <Label htmlFor="cpf">CPF *</Label>
            <Input
              id="cpf"
              value={form.cpf}
              onChange={(e) => set("cpf", maskCpf(e.target.value))}
              aria-invalid={!!erros.cpf}
            />
            {erros.cpf && <p className="mt-1 text-xs text-destructive">{erros.cpf}</p>}
          </div>

          <div>
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              value={form.telefone}
              onChange={(e) => set("telefone", maskTelefone(e.target.value))}
              aria-invalid={!!erros.telefone}
            />
            {erros.telefone && <p className="mt-1 text-xs text-destructive">{erros.telefone}</p>}
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              aria-invalid={!!erros.email}
            />
            {erros.email && <p className="mt-1 text-xs text-destructive">{erros.email}</p>}
          </div>

          <div>
            <Label>Empresa</Label>
            <Select value={form.empresa_id} onValueChange={(v) => set("empresa_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NENHUM}>Não definida</SelectItem>
                {(empresas ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome_fantasia || e.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tomador</Label>
            <Select value={form.tomador_id} onValueChange={(v) => set("tomador_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NENHUM}>Não definido</SelectItem>
                {(tomadores ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome_fantasia || t.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="unidade">Unidade</Label>
            <Input id="unidade" value={form.unidade} onChange={(e) => set("unidade", e.target.value)} />
          </div>

          <div>
            <Label htmlFor="cargo">Cargo *</Label>
            <Input
              id="cargo"
              value={form.cargo}
              onChange={(e) => set("cargo", e.target.value)}
              aria-invalid={!!erros.cargo}
            />
            {erros.cargo && <p className="mt-1 text-xs text-destructive">{erros.cargo}</p>}
          </div>

          <div>
            <Label htmlFor="data">Data prevista de admissão</Label>
            <Input
              id="data"
              type="date"
              value={form.data_prevista}
              onChange={(e) => set("data_prevista", e.target.value)}
            />
          </div>

          <div>
            <Label>Tipo de contrato</Label>
            <Select value={form.tipo_contrato} onValueChange={(v) => set("tipo_contrato", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clt">CLT</SelectItem>
                <SelectItem value="pj">PJ</SelectItem>
                <SelectItem value="temporario">Temporário</SelectItem>
                <SelectItem value="estagio">Estágio</SelectItem>
                <SelectItem value="terceirizado">Terceirizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="jornada">Jornada semanal (horas)</Label>
            <Input
              id="jornada"
              inputMode="numeric"
              value={form.jornada_semanal}
              onChange={(e) => set("jornada_semanal", onlyDigits(e.target.value).slice(0, 3))}
            />
          </div>

          <div>
            <Label htmlFor="salario">Salário (R$)</Label>
            <Input
              id="salario"
              inputMode="decimal"
              value={form.salario}
              onChange={(e) => set("salario", e.target.value.replace(/[^\d,.]/g, ""))}
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="obs">Observações</Label>
            <Textarea
              id="obs"
              rows={3}
              value={form.observacoes}
              onChange={(e) => set("observacoes", e.target.value)}
            />
          </div>

          <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
            >
              {mutation.isPending ? "Salvando..." : admissao ? "Salvar" : "Criar admissão"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
