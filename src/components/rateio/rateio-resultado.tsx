import { Building2, ReceiptText, ShieldCheck, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  formatarMoeda,
  type ModoRateio,
  type ResultadoRateio,
} from "@/lib/rateio-folha-api";

interface Props {
  resultado: ResultadoRateio;
  modo?: ModoRateio;
}

export function RateioResultado({ resultado, modo = "completo" }: Props) {
  if (!resultado.cnpjs.length) return null;

  const mostrarFolha = modo !== "encargos";
  const mostrarEncargos = modo !== "folha";
  const indicadores: Array<[string, string | number]> = [
    ["Empresas", resultado.resumo.empresas],
    ["Tomadores", resultado.resumo.tomadores],
    ["Colaboradores", resultado.resumo.colaboradores],
    ["Total geral", formatarMoeda(resultado.resumo.totalGeral)],
  ];

  const totais: Array<[string, string]> = [
    ...(mostrarFolha
      ? [["Total da Folha", formatarMoeda(resultado.resumo.folha)] as [string, string]]
      : []),
    ...(mostrarEncargos
      ? [
          ["FGTS + Consignado", formatarMoeda(resultado.resumo.fgtsConsignado)] as [string, string],
          ["INSS", formatarMoeda(resultado.resumo.inss)] as [string, string],
          ["IRRF", formatarMoeda(resultado.resumo.irrf)] as [string, string],
        ]
      : []),
  ];

  return (
    <div className="space-y-5">
      <Card className="border-gold/25 bg-accent/20 p-5 shadow-elegant">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gradient-gold p-2">
            <ReceiptText className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold">Resultado geral do rateio</h2>
            <p className="text-sm text-muted-foreground">
              Visão consolidada do arquivo processado. O detalhamento por tomador fica disponível na exportação em Excel.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {indicadores.map(([label, value], index) => {
          const Icon = index === 0 ? Building2 : index < 3 ? Users : ReceiptText;
          return (
            <Card key={label} className="border-border/60 p-4 shadow-elegant">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
                <Icon className="h-4 w-4 text-gold" />
              </div>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </Card>
          );
        })}
      </div>

      <Card className="border-border/60 p-5 shadow-elegant">
        <div className="mb-4 flex items-center gap-2">
          {mostrarEncargos && !mostrarFolha ? (
            <ShieldCheck className="h-5 w-5 text-gold" />
          ) : (
            <ReceiptText className="h-5 w-5 text-gold" />
          )}
          <h3 className="font-semibold">Totais consolidados</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {totais.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-lg font-semibold">{value}</p>
            </div>
          ))}
          <div className="rounded-lg border border-gold/30 bg-accent/25 p-4">
            <p className="text-xs text-muted-foreground">Total geral</p>
            <p className="mt-1 text-lg font-semibold text-gold">
              {formatarMoeda(resultado.resumo.totalGeral)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
