import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Building2,
  CalendarDays,
  FileSpreadsheet,
  Landmark,
  ReceiptText,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  formatarCompetencia,
  formatarMoeda,
  listarRateios,
  type RateioFolhaRegistro,
} from "@/lib/rateio-folha-api";

export const Route = createFileRoute("/_app/financeiro")({
  head: () => ({
    meta: [
      { title: "Dashboard Financeiro — Luxe People OS" },
      { name: "description", content: "Indicadores e evolução do rateio da folha." },
    ],
  }),
  component: DashboardFinanceiro,
});

function DashboardFinanceiro() {
  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["dashboard-financeiro"],
    queryFn: listarRateios,
  });
  const atual = registros[0];

  const evolucao = useMemo(
    () =>
      [...registros]
        .reverse()
        .map((item) => ({
          competencia: formatarCompetencia(item.competencia),
          folha: Number(item.total_folha),
          encargos:
            Number(item.total_fgts_consignado) + Number(item.total_inss) + Number(item.total_irrf),
        }))
        .slice(-12),
    [registros],
  );

  const porCnpj = useMemo(
    () =>
      (atual?.resultado?.cnpjs ?? []).map((item) => ({
        nome: formatarCnpjCurto(item.cnpj),
        total: item.totalGeral,
      })),
    [atual],
  );

  const porTomador = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const cnpj of atual?.resultado?.cnpjs ?? []) {
      for (const item of cnpj.detalhes)
        mapa.set(item.tomador, (mapa.get(item.tomador) ?? 0) + item.totalGeral);
    }
    return Array.from(mapa.entries())
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [atual]);

  const cards = [
    { label: "Competência", value: atual ? formatarCompetencia(atual.competencia) : "—", icon: CalendarDays },
    { label: "Empresas (CNPJs)", value: atual?.quantidade_empresas ?? 0, icon: Building2 },
    { label: "Tomadores", value: atual?.quantidade_tomadores ?? 0, icon: Landmark },
    { label: "Colaboradores", value: atual?.quantidade_colaboradores ?? 0, icon: Users },
    { label: "Valor total da folha", value: formatarMoeda(atual?.total_folha ?? 0), icon: WalletCards },
    { label: "FGTS + Consignado", value: formatarMoeda(atual?.total_fgts_consignado ?? 0), icon: ShieldCheck },
    { label: "Total INSS", value: formatarMoeda(atual?.total_inss ?? 0), icon: ReceiptText },
    { label: "Total IRRF", value: formatarMoeda(atual?.total_irrf ?? 0), icon: FileSpreadsheet },
    { label: "Total geral", value: formatarMoeda(atual?.total_geral ?? 0), icon: BarChart3 },
  ];

  return (
    <PageShell
      title="Dashboard Financeiro"
      description="Visão consolidada dos custos rateados por CNPJ e tomador."
      icon={<BarChart3 className="h-5 w-5 text-gold-foreground" />}
      actions={
        <Button asChild>
          <Link to="/rateio-folha">
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Novo Rateio
          </Link>
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.label} className="border-border/60 p-5 shadow-elegant">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {card.label}
                </p>
                <p className="mt-3 text-xl font-semibold tracking-tight">
                  {isLoading ? "Carregando..." : card.value}
                </p>
              </div>
              <div className="rounded-lg bg-accent p-2.5">
                <card.icon className="h-5 w-5 text-gold" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {!atual && !isLoading ? (
        <Card className="mt-6 flex min-h-64 flex-col items-center justify-center border-dashed p-8 text-center">
          <FileSpreadsheet className="mb-3 h-10 w-10 text-gold" />
          <h2 className="font-semibold">Nenhum rateio processado</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Importe a folha e a distribuição por tomador para alimentar os indicadores financeiros.
          </p>
          <Button asChild className="mt-4">
            <Link to="/rateio-folha">Processar primeiro rateio</Link>
          </Button>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <ChartCard titulo="Distribuição dos custos por CNPJ">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={porCnpj}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="nome" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={compactarMoeda} />
                <Tooltip formatter={(value) => formatarMoeda(Number(value))} />
                <Bar dataKey="total" name="Total" fill="#c9a227" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard titulo="Distribuição dos custos por Tomador">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={porTomador} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis type="number" fontSize={11} tickFormatter={compactarMoeda} />
                <YAxis dataKey="nome" type="category" width={110} fontSize={10} />
                <Tooltip formatter={(value) => formatarMoeda(Number(value))} />
                <Bar dataKey="total" name="Total" fill="#8b6f47" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard titulo="Evolução mensal da folha">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="competencia" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={compactarMoeda} />
                <Tooltip formatter={(value) => formatarMoeda(Number(value))} />
                <Line type="monotone" dataKey="folha" name="Folha" stroke="#c9a227" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard titulo="Evolução mensal dos encargos">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="competencia" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={compactarMoeda} />
                <Tooltip formatter={(value) => formatarMoeda(Number(value))} />
                <Legend />
                <Line type="monotone" dataKey="encargos" name="Encargos" stroke="#8b6f47" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </PageShell>
  );
}

function ChartCard({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card className="border-border/60 p-5 shadow-elegant">
      <h2 className="mb-4 font-semibold">{titulo}</h2>
      {children}
    </Card>
  );
}

function compactarMoeda(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatarCnpjCurto(cnpj: string): string {
  return cnpj.length === 14 ? cnpj.slice(0, 2) + "." + cnpj.slice(2, 5) + "…" + cnpj.slice(-4) : cnpj;
}
