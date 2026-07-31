import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Factory,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRoundCog,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/tomadores")({
  head: () => ({
    meta: [
      { title: "Tomadores — Gestão de RH" },
      {
        name: "description",
        content: "Cadastro de tomadores, endereços e coordenadores responsáveis.",
      },
    ],
  }),
  component: TomadoresPage,
});

type Coordenador = {
  id: string;
  tomador_id: string;
  nome_completo: string;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  is_active: boolean;
};

type Tomador = {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  is_active: boolean;
  tomador_coordenadores?: Coordenador[];
};

type TomadorForm = {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  telefone: string;
  email: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  is_active: boolean;
};

type CoordenadorForm = {
  nome_completo: string;
  cargo: string;
  email: string;
  telefone: string;
  is_active: boolean;
};

const db = supabase as any;

const tomadorVazio: TomadorForm = {
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  telefone: "",
  email: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  is_active: true,
};

const coordenadorVazio: CoordenadorForm = {
  nome_completo: "",
  cargo: "",
  email: "",
  telefone: "",
  is_active: true,
};

function numeros(valor: string) {
  return valor.replace(/\D/g, "");
}

function mascaraCnpj(valor: string) {
  const v = numeros(valor).slice(0, 14);
  return v
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function mascaraCep(valor: string) {
  return numeros(valor).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
}

function mascaraTelefone(valor: string) {
  const v = numeros(valor).slice(0, 11);
  if (v.length <= 10) {
    return v.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return v.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

function localizacao(tomador: Tomador) {
  const partes = [tomador.cidade, tomador.uf].filter(Boolean);
  return partes.length ? partes.join(" / ") : "Endereço não informado";
}

function TomadoresPage() {
  const { hasRole, canDelete, user } = useAuth();
  const podeGerenciar = hasRole("admin_principal") || hasRole("rh");
  const [tomadores, setTomadores] = useState<Tomador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  const [formAberto, setFormAberto] = useState(false);
  const [coordenadorAberto, setCoordenadorAberto] = useState(false);
  const [tomadorEditando, setTomadorEditando] = useState<Tomador | null>(null);
  const [tomadorDoCoordenador, setTomadorDoCoordenador] = useState<Tomador | null>(null);
  const [form, setForm] = useState<TomadorForm>(tomadorVazio);
  const [formCoordenador, setFormCoordenador] =
    useState<CoordenadorForm>(coordenadorVazio);

  async function carregarTomadores() {
    setCarregando(true);
    const { data, error } = await db
      .from("tomadores")
      .select("*, tomador_coordenadores(*)")
      .order("razao_social");

    if (error) {
      toast.error("Não foi possível carregar os tomadores.");
    } else {
      setTomadores((data ?? []) as Tomador[]);
    }
    setCarregando(false);
  }

  useEffect(() => {
    void carregarTomadores();
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return tomadores;
    return tomadores.filter((tomador) => {
      const coordenador = tomador.tomador_coordenadores?.[0];
      return [
        tomador.razao_social,
        tomador.nome_fantasia,
        tomador.cnpj,
        tomador.cidade,
        tomador.uf,
        coordenador?.nome_completo,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(termo);
    });
  }, [busca, tomadores]);

  const resumo = {
    total: tomadores.length,
    ativos: tomadores.filter((item) => item.is_active).length,
    coordenadores: tomadores.filter(
      (item) => (item.tomador_coordenadores?.length ?? 0) > 0,
    ).length,
    enderecos: tomadores.filter((item) => item.cidade || item.logradouro).length,
  };

  function abrirNovo() {
    setTomadorEditando(null);
    setForm(tomadorVazio);
    setFormAberto(true);
  }

  function abrirEdicao(tomador: Tomador) {
    setTomadorEditando(tomador);
    setForm({
      razao_social: tomador.razao_social,
      nome_fantasia: tomador.nome_fantasia ?? "",
      cnpj: tomador.cnpj ?? "",
      telefone: tomador.telefone ?? "",
      email: tomador.email ?? "",
      cep: tomador.cep ?? "",
      logradouro: tomador.logradouro ?? "",
      numero: tomador.numero ?? "",
      complemento: tomador.complemento ?? "",
      bairro: tomador.bairro ?? "",
      cidade: tomador.cidade ?? "",
      uf: tomador.uf ?? "",
      is_active: tomador.is_active,
    });
    setFormAberto(true);
  }

  function abrirCoordenador(tomador: Tomador) {
    const coordenador = tomador.tomador_coordenadores?.[0];
    setTomadorDoCoordenador(tomador);
    setFormCoordenador(
      coordenador
        ? {
            nome_completo: coordenador.nome_completo,
            cargo: coordenador.cargo ?? "",
            email: coordenador.email ?? "",
            telefone: coordenador.telefone ?? "",
            is_active: coordenador.is_active,
          }
        : coordenadorVazio,
    );
    setCoordenadorAberto(true);
  }

  async function salvarTomador() {
    if (!form.razao_social.trim()) {
      toast.error("Informe a razão social ou o nome do tomador.");
      return;
    }

    const cnpj = numeros(form.cnpj);
    if (cnpj && cnpj.length !== 14) {
      toast.error("O CNPJ deve conter 14 números.");
      return;
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error("Informe um e-mail válido.");
      return;
    }

    setSalvando(true);
    const payload = {
      razao_social: form.razao_social.trim(),
      nome_fantasia: form.nome_fantasia.trim() || null,
      cnpj: cnpj || null,
      telefone: numeros(form.telefone) || null,
      email: form.email.trim() || null,
      cep: numeros(form.cep) || null,
      logradouro: form.logradouro.trim() || null,
      numero: form.numero.trim() || null,
      complemento: form.complemento.trim() || null,
      bairro: form.bairro.trim() || null,
      cidade: form.cidade.trim() || null,
      uf: form.uf.trim().toUpperCase().slice(0, 2) || null,
      is_active: form.is_active,
    };

    const resultado = tomadorEditando
      ? await db.from("tomadores").update(payload).eq("id", tomadorEditando.id)
      : await db
          .from("tomadores")
          .insert({ ...payload, created_by: user?.id ?? null });

    setSalvando(false);
    if (resultado.error) {
      const mensagem =
        resultado.error.code === "23505"
          ? "Já existe um tomador com esse CNPJ."
          : "Não foi possível salvar o tomador.";
      toast.error(mensagem);
      return;
    }

    toast.success(tomadorEditando ? "Tomador atualizado." : "Tomador cadastrado.");
    setFormAberto(false);
    await carregarTomadores();
  }

  async function salvarCoordenador() {
    if (!tomadorDoCoordenador || !formCoordenador.nome_completo.trim()) {
      toast.error("Informe o nome do coordenador responsável.");
      return;
    }

    if (
      formCoordenador.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formCoordenador.email)
    ) {
      toast.error("Informe um e-mail válido.");
      return;
    }

    setSalvando(true);
    const { error } = await db.from("tomador_coordenadores").upsert(
      {
        tomador_id: tomadorDoCoordenador.id,
        nome_completo: formCoordenador.nome_completo.trim(),
        cargo: formCoordenador.cargo.trim() || null,
        email: formCoordenador.email.trim() || null,
        telefone: numeros(formCoordenador.telefone) || null,
        is_active: formCoordenador.is_active,
        created_by: user?.id ?? null,
      },
      { onConflict: "tomador_id" },
    );
    setSalvando(false);

    if (error) {
      toast.error("Não foi possível salvar o coordenador.");
      return;
    }

    toast.success("Coordenador responsável vinculado.");
    setCoordenadorAberto(false);
    await carregarTomadores();
  }

  async function excluirTomador(tomador: Tomador) {
    if (
      !window.confirm(
        "Excluir o tomador " + tomador.razao_social + "? Esta ação não pode ser desfeita.",
      )
    ) {
      return;
    }

    const { error } = await db.from("tomadores").delete().eq("id", tomador.id);
    if (error) {
      toast.error(
        "Não foi possível excluir. Verifique se existem colaboradores vinculados.",
      );
      return;
    }
    toast.success("Tomador excluído.");
    await carregarTomadores();
  }

  const cards = [
    { label: "Total de tomadores", value: resumo.total, icon: Factory },
    { label: "Ativos", value: resumo.ativos, icon: Building2 },
    { label: "Com coordenador", value: resumo.coordenadores, icon: Users },
    { label: "Com endereço", value: resumo.enderecos, icon: MapPin },
  ];

  return (
    <PageShell
      title="Tomadores"
      description="Cadastre tomadores, complete CNPJ e endereço e vincule o coordenador responsável."
      icon={<Factory className="h-5 w-5 text-gold-foreground" />}
      actions={
        podeGerenciar ? (
          <Button
            onClick={abrirNovo}
            className="bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
          >
            <Plus className="mr-1 h-4 w-4" /> Novo tomador
          </Button>
        ) : null
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{value}</p>
              </div>
              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <Icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar por tomador, CNPJ, cidade ou coordenador..."
              className="pl-9"
              aria-label="Buscar tomadores"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {carregando ? (
            <div className="flex min-h-52 items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando tomadores...
            </div>
          ) : filtrados.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center gap-2 px-6 text-center">
              <Factory className="h-9 w-9 text-muted-foreground" />
              <p className="font-medium">Nenhum tomador encontrado</p>
              <p className="text-sm text-muted-foreground">
                Ajuste a busca ou cadastre um novo tomador.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tomador</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Coordenador responsável</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((tomador) => {
                    const coordenador = tomador.tomador_coordenadores?.[0];
                    return (
                      <TableRow key={tomador.id}>
                        <TableCell>
                          <p className="font-medium">{tomador.razao_social}</p>
                          {tomador.nome_fantasia &&
                            tomador.nome_fantasia !== tomador.razao_social && (
                              <p className="text-xs text-muted-foreground">
                                {tomador.nome_fantasia}
                              </p>
                            )}
                        </TableCell>
                        <TableCell>
                          {tomador.cnpj ? (
                            mascaraCnpj(tomador.cnpj)
                          ) : (
                            <span className="text-muted-foreground">A preencher</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <p>{localizacao(tomador)}</p>
                          {tomador.logradouro && (
                            <p className="max-w-52 truncate text-xs text-muted-foreground">
                              {tomador.logradouro}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          {coordenador ? (
                            <>
                              <p className="font-medium">{coordenador.nome_completo}</p>
                              <p className="text-xs text-muted-foreground">
                                {coordenador.cargo || "Responsável"}
                              </p>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Não vinculado</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tomador.is_active ? "default" : "secondary"}>
                            {tomador.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {podeGerenciar && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => abrirCoordenador(tomador)}
                                  title="Adicionar ou alterar coordenador responsável"
                                >
                                  <UserRoundCog className="mr-1 h-4 w-4" />
                                  Coordenador
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => abrirEdicao(tomador)}
                                  title="Editar tomador"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => void excluirTomador(tomador)}
                                title="Excluir tomador"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {!podeGerenciar && (
        <p className="text-center text-xs text-muted-foreground">
          Seu perfil possui acesso de consulta. RH e Administrador Principal podem
          cadastrar e editar.
        </p>
      )}

      <Dialog open={formAberto} onOpenChange={setFormAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {tomadorEditando ? "Editar tomador" : "Novo tomador"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados básicos, de contato e endereço. O coordenador é
              adicionado separadamente após o cadastro.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            <section className="grid gap-3">
              <h3 className="font-semibold">Dados básicos</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="razao-social">Razão social ou identificação *</Label>
                  <Input
                    id="razao-social"
                    value={form.razao_social}
                    onChange={(event) =>
                      setForm({ ...form, razao_social: event.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nome-fantasia">Nome fantasia</Label>
                  <Input
                    id="nome-fantasia"
                    value={form.nome_fantasia}
                    onChange={(event) =>
                      setForm({ ...form, nome_fantasia: event.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={mascaraCnpj(form.cnpj)}
                    onChange={(event) => setForm({ ...form, cnpj: event.target.value })}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={mascaraTelefone(form.telefone)}
                    onChange={(event) =>
                      setForm({ ...form, telefone: event.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm({ ...form, email: event.target.value })
                    }
                  />
                </div>
              </div>
            </section>

            <section className="grid gap-3 border-t pt-5">
              <h3 className="font-semibold">Endereço</h3>
              <div className="grid gap-4 sm:grid-cols-6">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    value={mascaraCep(form.cep)}
                    onChange={(event) => setForm({ ...form, cep: event.target.value })}
                    placeholder="00000-000"
                  />
                </div>
                <div className="grid gap-2 sm:col-span-4">
                  <Label htmlFor="logradouro">Logradouro</Label>
                  <Input
                    id="logradouro"
                    value={form.logradouro}
                    onChange={(event) =>
                      setForm({ ...form, logradouro: event.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="numero">Número</Label>
                  <Input
                    id="numero"
                    value={form.numero}
                    onChange={(event) =>
                      setForm({ ...form, numero: event.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2 sm:col-span-4">
                  <Label htmlFor="complemento">Complemento</Label>
                  <Input
                    id="complemento"
                    value={form.complemento}
                    onChange={(event) =>
                      setForm({ ...form, complemento: event.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2 sm:col-span-3">
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input
                    id="bairro"
                    value={form.bairro}
                    onChange={(event) =>
                      setForm({ ...form, bairro: event.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    value={form.cidade}
                    onChange={(event) =>
                      setForm({ ...form, cidade: event.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="uf">UF</Label>
                  <Input
                    id="uf"
                    maxLength={2}
                    value={form.uf}
                    onChange={(event) =>
                      setForm({ ...form, uf: event.target.value.toUpperCase() })
                    }
                  />
                </div>
              </div>
            </section>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="status-tomador">Tomador ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Tomadores inativos permanecem no histórico.
                </p>
              </div>
              <Switch
                id="status-tomador"
                checked={form.is_active}
                onCheckedChange={(is_active) => setForm({ ...form, is_active })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormAberto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void salvarTomador()}
              disabled={salvando}
              className="bg-gradient-gold font-semibold"
            >
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar tomador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={coordenadorAberto} onOpenChange={setCoordenadorAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Coordenador responsável</DialogTitle>
            <DialogDescription>
              {tomadorDoCoordenador
                ? "Responsável por " + tomadorDoCoordenador.razao_social
                : "Vincule o responsável ao tomador."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="coordenador-nome">Nome completo *</Label>
              <Input
                id="coordenador-nome"
                value={formCoordenador.nome_completo}
                onChange={(event) =>
                  setFormCoordenador({
                    ...formCoordenador,
                    nome_completo: event.target.value,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="coordenador-cargo">Cargo</Label>
              <Input
                id="coordenador-cargo"
                value={formCoordenador.cargo}
                onChange={(event) =>
                  setFormCoordenador({
                    ...formCoordenador,
                    cargo: event.target.value,
                  })
                }
                placeholder="Ex.: Coordenador de contrato"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="coordenador-email">E-mail</Label>
                <Input
                  id="coordenador-email"
                  type="email"
                  value={formCoordenador.email}
                  onChange={(event) =>
                    setFormCoordenador({
                      ...formCoordenador,
                      email: event.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="coordenador-telefone">Telefone</Label>
                <Input
                  id="coordenador-telefone"
                  value={mascaraTelefone(formCoordenador.telefone)}
                  onChange={(event) =>
                    setFormCoordenador({
                      ...formCoordenador,
                      telefone: event.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="coordenador-ativo">Responsável ativo</Label>
              <Switch
                id="coordenador-ativo"
                checked={formCoordenador.is_active}
                onCheckedChange={(is_active) =>
                  setFormCoordenador({ ...formCoordenador, is_active })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCoordenadorAberto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void salvarCoordenador()}
              disabled={salvando}
              className="bg-gradient-gold font-semibold"
            >
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar coordenador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
