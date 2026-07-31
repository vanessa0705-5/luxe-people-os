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
import { Badge } from "@/components/ui/badge";
import {
  createEmpresa,
  listTomadoresDaEmpresa,
  updateEmpresa,
  type Empresa,
  type EmpresaInsert,
} from "@/lib/empresas-api";
import {
  UFS,
  isValidCep,
  isValidCnpj,
  isValidEmail,
  isValidTelefone,
  maskCep,
  maskCnpj,
  maskTelefone,
  onlyDigits,
} from "@/lib/br-format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa?: Empresa | null;
}

type FormState = Partial<EmpresaInsert>;

const empty: FormState = {
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  status: "ativa",
};

type FieldKey =
  | "razao_social"
  | "cnpj"
  | "cep"
  | "uf"
  | "email"
  | "telefone";

type Errors = Partial<Record<FieldKey, string>>;

export function EmpresaFormSheet({ open, onOpenChange, empresa }: Props) {
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [tab, setTab] = useState("dados");
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setTab("dados");
    if (empresa) {
      setForm({
        ...empresa,
        cnpj: maskCnpj(empresa.cnpj ?? ""),
        cep: empresa.cep ? maskCep(empresa.cep) : "",
        telefone: empresa.telefone ? maskTelefone(empresa.telefone) : "",
      });
    } else {
      setForm(empty);
    }
  }, [open, empresa]);

  const { data: vinculos = [] } = useQuery({
    queryKey: ["empresa-tomadores", empresa?.id],
    queryFn: () => listTomadoresDaEmpresa(empresa!.id),
    enabled: open && !!empresa?.id,
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  function validate(): Errors {
    const e: Errors = {};
    if (!form.razao_social?.trim()) e.razao_social = "Informe a razão social.";
    if (!form.cnpj?.trim()) e.cnpj = "Informe o CNPJ.";
    else if (!isValidCnpj(form.cnpj)) e.cnpj = "CNPJ inválido.";
    if (form.cep?.trim() && !isValidCep(form.cep)) e.cep = "CEP inválido (8 dígitos).";
    if (form.uf && form.uf.length !== 2) e.uf = "Selecione uma UF válida.";
    if (form.email?.trim() && !isValidEmail(form.email)) e.email = "E-mail inválido.";
    if (form.telefone?.trim() && !isValidTelefone(form.telefone))
      e.telefone = "Telefone inválido (10 ou 11 dígitos).";
    return e;
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: EmpresaInsert = {
        razao_social: form.razao_social!.trim(),
        nome_fantasia: form.nome_fantasia?.trim() || null,
        cnpj: onlyDigits(form.cnpj ?? ""),
        inscricao_estadual: form.inscricao_estadual?.trim() || null,
        inscricao_municipal: form.inscricao_municipal?.trim() || null,
        cnae: form.cnae?.trim() || null,
        status: form.status ?? "ativa",
        cep: form.cep ? onlyDigits(form.cep) : null,
        logradouro: form.logradouro?.trim() || null,
        numero: form.numero?.trim() || null,
        complemento: form.complemento?.trim() || null,
        bairro: form.bairro?.trim() || null,
        cidade: form.cidade?.trim() || null,
        uf: form.uf || null,
        responsavel_nome: form.responsavel_nome?.trim() || null,
        email: form.email?.trim() || null,
        telefone: form.telefone ? onlyDigits(form.telefone) : null,
        observacoes: form.observacoes?.trim() || null,
      };
      return empresa ? updateEmpresa(empresa.id, payload) : createEmpresa(payload);
    },
    onSuccess: () => {
      toast.success(empresa ? "Empresa atualizada com sucesso." : "Empresa cadastrada com sucesso.");
      qc.invalidateQueries({ queryKey: ["empresas"] });
      qc.invalidateQueries({ queryKey: ["empresas-resumo"] });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      if (/duplicate key|unique/i.test(msg)) {
        setErrors((prev) => ({ ...prev, cnpj: "Já existe uma empresa com este CNPJ." }));
        setTab("dados");
        toast.error("CNPJ já cadastrado.");
        return;
      }
      if (/row-level security|permission/i.test(msg)) {
        toast.error("Você não tem permissão para esta ação.");
        return;
      }
      toast.error(`Não foi possível salvar: ${msg}`);
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      if (e.razao_social || e.cnpj) setTab("dados");
      else if (e.cep || e.uf) setTab("endereco");
      else setTab("contato");
      toast.error("Verifique os campos destacados.");
      return;
    }
    mutation.mutate();
  }

  const Err = ({ msg }: { msg?: string }) =>
    msg ? (
      <p role="alert" className="mt-1 text-xs text-destructive">
        {msg}
      </p>
    ) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{empresa ? "Editar empresa" : "Nova empresa"}</SheetTitle>
          <SheetDescription>
            Preencha os dados cadastrais da empresa. Campos com * são obrigatórios.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-6">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
              <TabsTrigger value="dados">Dados cadastrais</TabsTrigger>
              <TabsTrigger value="endereco">Endereço</TabsTrigger>
              <TabsTrigger value="contato">Contato</TabsTrigger>
              <TabsTrigger value="vinculos">Vínculos</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="mt-4 space-y-4">
              <div>
                <Label htmlFor="razao_social">Razão social *</Label>
                <Input
                  id="razao_social"
                  value={form.razao_social ?? ""}
                  onChange={(e) => set("razao_social", e.target.value)}
                  aria-invalid={!!errors.razao_social}
                  required
                />
                <Err msg={errors.razao_social} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="nome_fantasia">Nome fantasia</Label>
                  <Input
                    id="nome_fantasia"
                    value={form.nome_fantasia ?? ""}
                    onChange={(e) => set("nome_fantasia", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="cnpj">CNPJ *</Label>
                  <Input
                    id="cnpj"
                    inputMode="numeric"
                    placeholder="00.000.000/0000-00"
                    value={form.cnpj ?? ""}
                    onChange={(e) => set("cnpj", maskCnpj(e.target.value))}
                    aria-invalid={!!errors.cnpj}
                    required
                  />
                  <Err msg={errors.cnpj} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="inscricao_estadual">Inscrição estadual</Label>
                  <Input
                    id="inscricao_estadual"
                    value={form.inscricao_estadual ?? ""}
                    onChange={(e) => set("inscricao_estadual", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="inscricao_municipal">Inscrição municipal</Label>
                  <Input
                    id="inscricao_municipal"
                    value={form.inscricao_municipal ?? ""}
                    onChange={(e) => set("inscricao_municipal", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="cnae">CNAE</Label>
                  <Input
                    id="cnae"
                    value={form.cnae ?? ""}
                    onChange={(e) => set("cnae", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={form.status ?? "ativa"}
                    onValueChange={(v) => set("status", v as "ativa" | "inativa")}
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativa">Ativa</SelectItem>
                      <SelectItem value="inativa">Inativa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  rows={3}
                  value={form.observacoes ?? ""}
                  onChange={(e) => set("observacoes", e.target.value)}
                />
              </div>
            </TabsContent>

            <TabsContent value="endereco" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    inputMode="numeric"
                    placeholder="00000-000"
                    value={form.cep ?? ""}
                    onChange={(e) => set("cep", maskCep(e.target.value))}
                    aria-invalid={!!errors.cep}
                  />
                  <Err msg={errors.cep} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="logradouro">Logradouro</Label>
                  <Input
                    id="logradouro"
                    value={form.logradouro ?? ""}
                    onChange={(e) => set("logradouro", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="numero">Número</Label>
                  <Input
                    id="numero"
                    value={form.numero ?? ""}
                    onChange={(e) => set("numero", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="complemento">Complemento</Label>
                  <Input
                    id="complemento"
                    value={form.complemento ?? ""}
                    onChange={(e) => set("complemento", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input
                    id="bairro"
                    value={form.bairro ?? ""}
                    onChange={(e) => set("bairro", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    value={form.cidade ?? ""}
                    onChange={(e) => set("cidade", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="uf">UF</Label>
                  <Select value={form.uf ?? ""} onValueChange={(v) => set("uf", v)}>
                    <SelectTrigger id="uf" aria-invalid={!!errors.uf}>
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {UFS.map((uf) => (
                        <SelectItem key={uf} value={uf}>
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Err msg={errors.uf} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contato" className="mt-4 space-y-4">
              <div>
                <Label htmlFor="responsavel_nome">Nome do responsável</Label>
                <Input
                  id="responsavel_nome"
                  value={form.responsavel_nome ?? ""}
                  onChange={(e) => set("responsavel_nome", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) => set("email", e.target.value)}
                    aria-invalid={!!errors.email}
                  />
                  <Err msg={errors.email} />
                </div>
                <div>
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    inputMode="tel"
                    placeholder="(00) 00000-0000"
                    value={form.telefone ?? ""}
                    onChange={(e) => set("telefone", maskTelefone(e.target.value))}
                    aria-invalid={!!errors.telefone}
                  />
                  <Err msg={errors.telefone} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="vinculos" className="mt-4 space-y-3">
              {!empresa ? (
                <p className="text-sm text-muted-foreground">
                  Salve a empresa para depois vincular tomadores e colaboradores.
                </p>
              ) : vinculos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum tomador vinculado a esta empresa.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {vinculos.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 p-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{t.razao_social}</p>
                        <p className="text-xs text-muted-foreground">{maskCnpj(t.cnpj)}</p>
                      </div>
                      <Badge variant="outline" className="border-gold/40 text-gold">
                        {t.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>

          <SheetFooter className="flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
