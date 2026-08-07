import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  HeartPulse,
  LayoutDashboard,
  Loader2,
  Palmtree,
  ShieldCheck,
  Users,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { getColaboradoresResumo } from "@/lib/colaboradores-api";
import { getEmpresasResumo } from "@/lib/empresas-api";
import { getFeriasResumo } from "@/lib/ferias-api";
import { getAsosResumo } from "@/lib/aso-api";
import { getNrsResumo } from "@/lib/nrs-api";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Gestão de RH" },
      { name: "description", content: "Visão geral do sistema de RH." },
    ],
  }),
  component: Dashboard,
});

async function carregarResumo() {
  const [colaboradores, empresas, ferias, asos, nrs] = await Promise.all([
    getColaboradoresResumo(),
    getEmpresasResumo(),
    getFeriasResumo(),
    getAsosResumo(),
    getNrsResumo(),
  ]);
  return { colaboradores, empresas, ferias, asos, nrs };
}

function Dashboard() {
  const { profile } = useAuth();
  const firstName = (profile?.full_name || profile?.email || "").split(" ")[0];
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard-resumo"],
    queryFn: carregarResumo,
    staleTime: 60_000,
  });

  const stats = [
    {
      label: "Colaboradores ativos",
      value: data?.colaboradores.ativos ?? 0,
      icon: Users,
      hint: (data?.colaboradores.total ?? 0) + " cadastrados",
      to: "/colaboradores" as const,
    },
    {
      label: "Empresas ativas",
      value: data?.empresas.ativas ?? 0,
      icon: Building2,
      hint: (data?.empresas.total ?? 0) + " CNPJs cadastrados",
      to: "/empresas" as const,
    },
    {
      label: "Férias em andamento",
      value: data?.ferias.emGozo ?? 0,
      icon: Palmtree,
      hint: (data?.ferias.proximas30 ?? 0) + " nos próximos 30 dias",
      to: "/ferias" as const,
    },
    {
      label: "ASOs vencidos",
      value: data?.asos.vencidos ?? 0,
      icon: HeartPulse,
      hint: (data?.asos.aVencer30 ?? 0) + " a vencer",
      to: "/aso" as const,
    },
    {
      label: "NRs vencidas",
      value: data?.nrs.vencidos ?? 0,
      icon: ShieldCheck,
      hint: (data?.nrs.aVencer30 ?? 0) + " a vencer",
      to: "/nrs" as const,
    },
  ];

  return (
    <PageShell
      title={firstName ? "Olá, " + firstName : "Dashboard"}
      description="Visão geral atualizada da Gestão de Recursos Humanos."
      icon={<LayoutDashboard className="h-5 w-5 text-gold-foreground" />}
    >
      {isError && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Não foi possível atualizar os indicadores.
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-sm font-medium text-gold hover:underline"
          >
            Tentar novamente
          </button>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <Link key={stat.label} to={stat.to} className="group">
            <Card className="h-full border-border/60 p-5 shadow-elegant transition-all group-hover:-translate-y-0.5 group-hover:border-gold/40 group-hover:shadow-gold">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                    {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-gold" /> : stat.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
                  <stat.icon className="h-5 w-5 text-gold" />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 p-6 shadow-elegant lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Pendências de Saúde e Segurança</h3>
              <p className="text-xs text-muted-foreground">Itens que precisam de atenção da equipe</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-gold" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "ASOs a vencer", value: data?.asos.aVencer30 ?? 0, to: "/aso" as const },
              { label: "ASOs vencidos", value: data?.asos.vencidos ?? 0, to: "/aso" as const },
              { label: "NRs a vencer", value: data?.nrs.aVencer30 ?? 0, to: "/nrs" as const },
              { label: "NRs vencidas", value: data?.nrs.vencidos ?? 0, to: "/nrs" as const },
            ].map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-4 transition-colors hover:border-gold/40"
              >
                <span className="text-sm text-foreground/80">{item.label}</span>
                <span className="text-xl font-semibold text-foreground">{isLoading ? "—" : item.value}</span>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="border-border/60 p-6 shadow-elegant">
          <h3 className="text-base font-semibold">Acesso rápido</h3>
          <p className="text-xs text-muted-foreground">Atalhos para os módulos principais</p>
          <div className="mt-4 flex flex-col gap-2">
            {[
              { label: "Colaboradores", to: "/colaboradores" as const },
              { label: "Tomadores", to: "/tomadores" as const },
              { label: "ASO", to: "/aso" as const },
              { label: "NRs", to: "/nrs" as const },
            ].map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground/80 transition-colors hover:border-gold/40 hover:text-foreground"
              >
                <span>{item.label}</span>
                <ArrowRight className="h-4 w-4 text-gold" />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
