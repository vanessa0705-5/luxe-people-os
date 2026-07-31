import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createColaborador,
  listTomadores,
  updateColaborador,
  type Colaborador,
  type ColaboradorInsert,
} from "@/lib/colaboradores-api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colaborador?: Colaborador | null;
}

type FormState = Partial<ColaboradorInsert>;

const empty: FormState = {
  nome_completo: "",
  cpf: "",
  nacionalidade: "Brasileira",
  status: "ativo",
};

type Errors = Partial<Record<"nome_completo" | "cpf" | "email", string>>;

const onlyDigits = (v: string) => v.replace(/\D/g, "");

export function ColaboradorFormSheet({ open, onOpenChange, colaborador }: Props) {
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [tab, setTab] = useState("pessoais");
  const qc = useQueryClient();

  const { data: tomadores = [] } = useQuery({
    queryKey: ["tomadores", "ativos"],
    queryFn: listTomadores,
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setForm(colaborador ? { ...colaborador } : empty);
      setErrors({});
      setTab("pessoais");
    }
  }, [open, colaborador]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k as string]: undefined }));
  };

  const isEdit = Boolean(colaborador?.id);

  function validate(): Errors {
    const e: Errors = {};
    const nome = (form.nome_completo ?? "").trim();
    if (!nome) e.nome_completo = "Informe o nome completo.";
    else if (nome.length < 3) e.nome_completo = "O nome deve ter ao menos 3 caracteres.";
    else if (nome.length > 120) e.nome_completo = "O nome deve ter no máximo 120 caracteres.";

    const cpf = onlyDigits(form.cpf ?? "");
    if (!cpf) e.cpf = "Informe o CPF.";
    else if (cpf.length !== 11) e.cpf = "O CPF deve conter 11 dígitos.";

    const email = (form.email ?? "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
      e.email = "Informe um e-mail válido.";

    return e;
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const e = validate();
      setErrors(e);
      if (Object.keys(e).length > 0) {
        if (e.nome_completo || e.cpf || e.email) setTab("pessoais");
        throw new Error("Verifique os campos destacados antes de salvar.");
      }
      const payload = { ...form } as ColaboradorInsert;
      if (isEdit && colaborador) {
        return updateColaborador(colaborador.id, payload);
      }
      return createColaborador(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["colaboradores"] });
      toast.success(
        isEdit ? "Colaborador atualizado com sucesso" : "Colaborador cadastrado com sucesso",
      );
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message || "Não foi possível salvar o colaborador"),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="text-xl">
            {isEdit ? "Editar colaborador" : "Novo colaborador"}
          </SheetTitle>
          <SheetDescription>
            Preencha os dados abaixo. Os campos com * são obrigatórios.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 px-4">
          {tomadores.length === 0 && (
            <div className="mb-4 rounded-md border border-dashed border-gold/40 bg-gold/5 p-3 text-xs text-muted-foreground">
              Nenhum tomador cadastrado. Você pode continuar e vincular um tomador depois.
            </div>
          )}

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
              <TabsTrigger value="pessoais">Pessoais</TabsTrigger>
              <TabsTrigger value="contratuais">Contratuais</TabsTrigger>
              <TabsTrigger value="endereco">Endereço</TabsTrigger>
              <TabsTrigger value="documentos">Documentos</TabsTrigger>
            </TabsList>

            <TabsContent value="pessoais" className="space-y-3 pt-4">
              <Field label="Nome completo *" error={errors.nome_completo}>
                <Input
                  value={form.nome_completo ?? ""}
                  aria-invalid={Boolean(errors.nome_completo)}
                  onChange={(e) => set("nome_completo", e.target.value)}
                />
              </Field>


              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="CPF *" error={errors.cpf}>
                  <Input
                    inputMode="numeric"
                    maxLength={14}
                    aria-invalid={Boolean(errors.cpf)}
                    value={form.cpf ?? ""}
                    onChange={(e) => set("cpf", e.target.value)}
                  />
                </Field>
                <Field label="RG">
                  <Input value={form.rg ?? ""} onChange={(e) => set("rg", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Órgão emissor">
                  <Input
                    value={form.rg_orgao_emissor ?? ""}
                    onChange={(e) => set("rg_orgao_emissor", e.target.value)}
                  />
                </Field>
                <Field label="Data de nascimento">
                  <Input
                    type="date"
                    value={form.data_nascimento ?? ""}
                    onChange={(e) => set("data_nascimento", e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Sexo">
                  <Select
                    value={form.sexo ?? undefined}
                    onValueChange={(v) => set("sexo", v as never)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Estado civil">
                  <Select
                    value={form.estado_civil ?? undefined}
                    onValueChange={(v) => set("estado_civil", v as never)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                      <SelectItem value="casado">Casado(a)</SelectItem>
                      <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                      <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                      <SelectItem value="uniao_estavel">União Estável</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nacionalidade">
                  <Input
                    value={form.nacionalidade ?? ""}
                    onChange={(e) => set("nacionalidade", e.target.value)}
                  />
                </Field>
                <Field label="Telefone">
                  <Input
                    value={form.telefone ?? ""}
                    onChange={(e) => set("telefone", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="E-mail" error={errors.email}>
                <Input
                  type="email"
                  aria-invalid={Boolean(errors.email)}
                  value={form.email ?? ""}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
            </TabsContent>

            <TabsContent value="contratuais" className="space-y-3 pt-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Matrícula">
                  <Input
                    value={form.matricula ?? ""}
                    onChange={(e) => set("matricula", e.target.value)}
                  />
                </Field>
                <Field label="Data de admissão">
                  <Input
                    type="date"
                    value={form.data_admissao ?? ""}
                    onChange={(e) => set("data_admissao", e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Cargo">
                  <Input value={form.cargo ?? ""} onChange={(e) => set("cargo", e.target.value)} />
                </Field>
                <Field label="Função">
                  <Input
                    value={form.funcao ?? ""}
                    onChange={(e) => set("funcao", e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Departamento">
                  <Input
                    value={form.departamento ?? ""}
                    onChange={(e) => set("departamento", e.target.value)}
                  />
                </Field>
                <Field label="Tipo de contrato">
                  <Select
                    value={form.tipo_contrato ?? undefined}
                    onValueChange={(v) => set("tipo_contrato", v as never)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clt">CLT</SelectItem>
                      <SelectItem value="pj">PJ</SelectItem>
                      <SelectItem value="temporario">Temporário</SelectItem>
                      <SelectItem value="estagio">Estágio</SelectItem>
                      <SelectItem value="terceirizado">Terceirizado</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Salário (R$)">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.salario ?? ""}
                    onChange={(e) =>
                      set("salario", e.target.value ? Number(e.target.value) : null)
                    }
                  />
                </Field>
                <Field label="Jornada (h/semana)">
                  <Input
                    type="number"
                    value={form.jornada_semanal ?? ""}
                    onChange={(e) =>
                      set("jornada_semanal", e.target.value ? Number(e.target.value) : null)
                    }
                  />
                </Field>
              </div>
              <Field label="Tomador (opcional)">
                <Select
                  value={form.tomador_id ?? "__sem_tomador__"}
                  onValueChange={(v) =>
                    set("tomador_id", v === "__sem_tomador__" ? null : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tomador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__sem_tomador__">Sem tomador</SelectItem>
                    {tomadores.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Banco">
                  <Input value={form.banco ?? ""} onChange={(e) => set("banco", e.target.value)} />
                </Field>
                <Field label="Agência">
                  <Input
                    value={form.agencia ?? ""}
                    onChange={(e) => set("agencia", e.target.value)}
                  />
                </Field>
                <Field label="Conta">
                  <Input value={form.conta ?? ""} onChange={(e) => set("conta", e.target.value)} />
                </Field>
              </div>
              <Field label="Status">
                <Select
                  value={form.status ?? "ativo"}
                  onValueChange={(v) => set("status", v as never)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="afastado">Afastado</SelectItem>
                    <SelectItem value="ferias">Em Férias</SelectItem>
                    <SelectItem value="desligado">Desligado</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Observações">
                <Textarea
                  rows={3}
                  value={form.observacoes ?? ""}
                  onChange={(e) => set("observacoes", e.target.value)}
                />
              </Field>
            </TabsContent>

            <TabsContent value="endereco" className="space-y-3 pt-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="CEP">
                  <Input value={form.cep ?? ""} onChange={(e) => set("cep", e.target.value)} />
                </Field>
                <div className="col-span-2">
                  <Field label="Logradouro">
                    <Input
                      value={form.logradouro ?? ""}
                      onChange={(e) => set("logradouro", e.target.value)}
                    />
                  </Field>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Número">
                  <Input
                    value={form.numero ?? ""}
                    onChange={(e) => set("numero", e.target.value)}
                  />
                </Field>
                <div className="col-span-2">
                  <Field label="Complemento">
                    <Input
                      value={form.complemento ?? ""}
                      onChange={(e) => set("complemento", e.target.value)}
                    />
                  </Field>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Bairro">
                  <Input
                    value={form.bairro ?? ""}
                    onChange={(e) => set("bairro", e.target.value)}
                  />
                </Field>
                <Field label="Cidade">
                  <Input
                    value={form.cidade ?? ""}
                    onChange={(e) => set("cidade", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="UF">
                <Input
                  maxLength={2}
                  value={form.uf ?? ""}
                  onChange={(e) => set("uf", e.target.value.toUpperCase())}
                />
              </Field>
            </TabsContent>

            <TabsContent value="documentos" className="space-y-3 pt-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="CTPS nº">
                  <Input
                    value={form.ctps_numero ?? ""}
                    onChange={(e) => set("ctps_numero", e.target.value)}
                  />
                </Field>
                <Field label="Série CTPS">
                  <Input
                    value={form.ctps_serie ?? ""}
                    onChange={(e) => set("ctps_serie", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="PIS/PASEP">
                <Input
                  value={form.pis_pasep ?? ""}
                  onChange={(e) => set("pis_pasep", e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Título de eleitor">
                  <Input
                    value={form.titulo_eleitor ?? ""}
                    onChange={(e) => set("titulo_eleitor", e.target.value)}
                  />
                </Field>
                <Field label="Zona">
                  <Input
                    value={form.titulo_zona ?? ""}
                    onChange={(e) => set("titulo_zona", e.target.value)}
                  />
                </Field>
                <Field label="Seção">
                  <Input
                    value={form.titulo_secao ?? ""}
                    onChange={(e) => set("titulo_secao", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Reservista">
                <Input
                  value={form.reservista ?? ""}
                  onChange={(e) => set("reservista", e.target.value)}
                />
              </Field>
            </TabsContent>
          </Tabs>
        </div>

        <SheetFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Salvando..." : isEdit ? "Salvar alterações" : "Cadastrar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
