import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UserCog, UserPlus, Users, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listColaboradores, updateColaborador } from "@/lib/colaboradores-api";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/coordenadores")({
  head: () => ({
    meta: [
      { title: "Coordenadores — Gestão de RH" },
      {
        name: "description",
        content:
          "Coordenadores e responsáveis: equipes vinculadas, promoção de colaboradores e tomadores atendidos.",
      },
      { property: "og:title", content: "Coordenadores — Gestão de RH" },
      {
        property: "og:description",
        content: "Gerencie coordenadores, equipes vinculadas e tomadores atendidos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CoordenadoresPage,
});

function CoordenadoresPage() {
  const { hasRole, isAdminPrincipal } = useAuth();
  const podeGerenciar = isAdminPrincipal || hasRole("rh");
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [selecionado, setSelecionado] = useState("");

  const { data: colaboradores = [], isLoading, isError } = useQuery({
    queryKey: ["colaboradores", "coordenadores"],
    queryFn: () => listColaboradores({ status: "todos" }),
  });

  const coordenadores = useMemo(
    () => colaboradores.filter((c) => c.is_coordenador),
    [colaboradores],
  );

  const equipePorCoordenador = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const c of colaboradores) {
      if (!c.coordenador_id) continue;
      mapa.set(c.coordenador_id, (mapa.get(c.coordenador_id) ?? 0) + 1);
    }
    return mapa;
  }, [colaboradores]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return coordenadores;
    return coordenadores.filter((c) =>
      [c.nome_completo, c.matricula, c.cargo, c.departamento, c.email]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(termo),
    );
  }, [busca, coordenadores]);

  const semEquipe = colaboradores.filter((c) => !c.coordenador_id && !c.is_coordenador).length;
  const departamentos = new Set(
    coordenadores.map((c) => (c.departamento ?? "").trim()).filter(Boolean),
  ).size;

  const mutation = useMutation({
    mutationFn: ({ id, valor }: { id: string; valor: boolean }) =>
      updateColaborador(id, { is_coordenador: valor }),
    onSuccess: (_data, vars) => {
      toast.success(
        vars.valor ? "Colaborador promovido a coordenador." : "Coordenador removido da função.",
      );
      queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
      setDialogAberto(false);
      setSelecionado("");
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a alteração."),
  });

  const elegiveis = colaboradores.filter((c) => !c.is_coordenador && c.status !== "desligado");

  const cards = [
    { label: "Coordenadores", valor: coordenadores.length, icone: UserCog },
    {
      label: "Colaboradores coordenados",
      valor: Array.from(equipePorCoordenador.values()).reduce((a, b) => a + b, 0),
      icone: Users,
    },
    { label: "Departamentos cobertos", valor: departamentos, icone: Building2 },
    { label: "Sem coordenador", valor: semEquipe, icone: UserPlus },
  ];

  return (
    <PageShell
      title="Coordenadores"
      description="Colaboradores marcados como coordenadores e suas equipes vinculadas."
      icon={<UserCog className="h-5 w-5 text-gold-foreground" />}
      actions={
        podeGerenciar ? (
          <Button
            onClick={() => setDialogAberto(true)}
            className="bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
          >
            <UserPlus className="mr-1 h-4 w-4" /> Novo coordenador
          </Button>
        ) : null
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, valor, icone: Icone }) => (
          <Card key={label} className="border-border">
            <CardContent className="flex items-center justify-between gap-3 p-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                {isLoading ? (
                  <Skeleton className="mt-2 h-7 w-12" />
                ) : (
                  <p className="mt-1 text-2xl font-semibold text-foreground">{valor}</p>
                )}
              </div>
              <Icone className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, matrícula, cargo ou departamento"
            aria-label="Buscar coordenadores"
            className="pl-9"
          />
        </div>
      </div>

      <div className="mt-4">
        {isError ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Não foi possível carregar os coordenadores. Tente novamente.
          </p>
        ) : isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum coordenador encontrado. Marque um colaborador como coordenador para começar.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coordenador</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Equipe</TableHead>
                    <TableHead>Situação</TableHead>
                    {podeGerenciar && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <p className="font-medium text-foreground">{c.nome_completo}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.matricula ? `Matrícula ${c.matricula}` : (c.email ?? "—")}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">{c.cargo ?? "—"}</TableCell>
                      <TableCell className="text-sm">{c.departamento ?? "—"}</TableCell>
                      <TableCell className="text-sm">
                        {equipePorCoordenador.get(c.id) ?? 0} colaborador(es)
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.status === "ativo" ? "secondary" : "outline"}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      {podeGerenciar && (
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={mutation.isPending}
                            onClick={() => mutation.mutate({ id: c.id, valor: false })}
                          >
                            Remover função
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="space-y-3 md:hidden">
              {filtrados.map((c) => (
                <li key={c.id}>
                  <Card className="border-border">
                    <CardContent className="space-y-2 p-4">
                      <p className="font-medium text-foreground">{c.nome_completo}</p>
                      <p className="text-xs text-muted-foreground">
                        {[c.cargo, c.departamento].filter(Boolean).join(" • ") || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Equipe: {equipePorCoordenador.get(c.id) ?? 0} colaborador(es)
                      </p>
                      {podeGerenciar && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          disabled={mutation.isPending}
                          onClick={() => mutation.mutate({ id: c.id, valor: false })}
                        >
                          Remover função
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {!podeGerenciar && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Seu perfil permite apenas consultar os coordenadores.
        </p>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo coordenador</DialogTitle>
            <DialogDescription>
              Selecione um colaborador do cadastro para marcá-lo como coordenador.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select value={selecionado} onValueChange={setSelecionado}>
              <SelectTrigger aria-label="Colaborador">
                <SelectValue placeholder="Selecione o colaborador" />
              </SelectTrigger>
              <SelectContent>
                {elegiveis.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome_completo}
                    {c.cargo ? ` — ${c.cargo}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!selecionado || mutation.isPending}
              onClick={() => mutation.mutate({ id: selecionado, valor: true })}
              className="bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
