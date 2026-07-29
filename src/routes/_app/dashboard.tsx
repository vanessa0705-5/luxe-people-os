import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Building2,
  Palmtree,
  UserMinus,
  TrendingUp,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Gestão de RH" },
      { name: "description", content: "Visão geral do sistema de RH." },
    ],
  }),
  component: Dashboard,
});

const stats = [
  { label: "Colaboradores ativos", value: "—", icon: Users, hint: "Total no período" },
  { label: "Empresas cadastradas", value: "—", icon: Building2, hint: "CNPJs vinculados" },
  { label: "Férias em andamento", value: "—", icon: Palmtree, hint: "Este mês" },
  { label: "Desligamentos", value: "—", icon: UserMinus, hint: "Últimos 30 dias" },
];

function Dashboard() {
  const { profile } = useAuth();
  const firstName = (profile?.full_name || profile?.email || "").split(" ")[0];

  return (
    <PageShell
      title={firstName ? `Olá, ${firstName}` : "Dashboard"}
      description="Visão geral do sistema de Gestão de Recursos Humanos."
      icon={<LayoutDashboard className="h-5 w-5 text-gold-foreground" />}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card
            key={s.label}
            className="border-border/60 p-5 shadow-elegant transition-all hover:border-gold/40 hover:shadow-gold"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                  {s.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                <s.icon className="h-5 w-5 text-gold" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 p-6 shadow-elegant lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Atividade recente</h3>
              <p className="text-xs text-muted-foreground">
                Últimas movimentações registradas no sistema
              </p>
            </div>
            <TrendingUp className="h-4 w-4 text-gold" />
          </div>
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            Área reservada para o feed de atividades
          </div>
        </Card>

        <Card className="border-border/60 p-6 shadow-elegant">
          <h3 className="text-base font-semibold">Acesso rápido</h3>
          <p className="text-xs text-muted-foreground">Atalhos operacionais</p>
          <div className="mt-4 flex flex-col gap-2">
            {["Novo colaborador", "Registrar férias", "Nova movimentação", "Gerar relatório"].map(
              (a) => (
                <div
                  key={a}
                  className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground/80"
                >
                  <span>{a}</span>
                  <span className="text-[10px] uppercase tracking-wider text-gold">Em breve</span>
                </div>
              ),
            )}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
