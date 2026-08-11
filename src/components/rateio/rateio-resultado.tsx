import { Building2, ReceiptText, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatarMoeda,
  type ModoRateio,
  type ResultadoRateio,
  type RateioTomador,
} from "@/lib/rateio-folha-api";

interface Props {
  resultado: ResultadoRateio;
  modo?: ModoRateio;
}


type ChaveValor = keyof Pick<RateioTomador, "folha" | "fgtsConsignado" | "inss" | "irrf">;

const encargos: Array<{ titulo: string; chave: ChaveValor }> = [
  { titulo: "FGTS + Consignado", chave: "fgtsConsignado" },
  { titulo: "INSS", chave: "inss" },
  { titulo: "IRRF", chave: "irrf" },
];

function TabelaRateio({
  titulo,
  chave,
  total,
  detalhes,
}: {
  titulo: string;
  chave: ChaveValor;
  total: number;
  detalhes: RateioTomador[];
}) {
  return (
    <Card className="overflow-hidden border-border/60 shadow-elegant">
      <div className="flex items-center justify-between border-b border-border bg-muted/35 px-5 py-4">
        <h4 className="font-semibold">{titulo}</h4>
        <span className="text-sm font-semibold text-gold">{formatarMoeda(total)}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3 font-medium">Tomador</th>
              <th className="px-3 py-3 text-center font-medium">Colaboradores</th>
              <th className="px-5 py-3 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {detalhes.map((item) => (
              <tr key={item.tomador} className="border-b border-border/60 last:border-0">
                <td className="px-5 py-3 font-medium">{item.tomador}</td>
                <td className="px-3 py-3 text-center">{item.colaboradores}</td>
                <td className="px-5 py-3 text-right">{formatarMoeda(item[chave])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function RateioResultado({ resultado, modo = "completo" }: Props) {
  if (!resultado.cnpjs.length) return null;
  const mostrarFolha = modo !== "encargos";
  const mostrarEncargos = modo !== "folha";


  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Empresas", resultado.resumo.empresas],
          ["Tomadores", resultado.resumo.tomadores],
          ["Colaboradores", resultado.resumo.colaboradores],
          ["Total geral", formatarMoeda(resultado.resumo.totalGeral)],
        ].map(([label, value]) => (
          <Card key={String(label)} className="border-border/60 p-4 shadow-elegant">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </Card>
        ))}
      </div>

      <Tabs defaultValue={resultado.cnpjs[0].cnpj}>
        <TabsList className="h-auto max-w-full flex-wrap justify-start">
          {resultado.cnpjs.map((cnpj) => (
            <TabsTrigger key={cnpj.cnpj} value={cnpj.cnpj}>
              CNPJ {cnpj.cnpj}
            </TabsTrigger>
          ))}
        </TabsList>

        {resultado.cnpjs.map((cnpj) => (
          <TabsContent key={cnpj.cnpj} value={cnpj.cnpj} className="space-y-6">
            <Card className="border-gold/25 bg-accent/30 p-5 shadow-elegant">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-gradient-gold p-2">
                    <Building2 className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">CNPJ {cnpj.cnpj}</h3>
                    <p className="text-xs text-muted-foreground">
                      {cnpj.tomadores} tomadores · {cnpj.colaboradores} colaboradores
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="border-gold/40 text-sm">
                  Total {formatarMoeda(cnpj.totalGeral)}
                </Badge>
              </div>
            </Card>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <ReceiptText className="h-5 w-5 text-gold" />
                <div>
                  <h3 className="font-semibold">Folha</h3>
                  <p className="text-xs text-muted-foreground">Valores da folha distribuídos por tomador.</p>
                </div>
              </div>
              <TabelaRateio
                titulo="Rateio da Folha"
                chave="folha"
                total={cnpj.folha}
                detalhes={cnpj.detalhes}
              />
            </section>

            <section className="space-y-3 rounded-xl border border-border/70 bg-muted/15 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-gold" />
                <div>
                  <h3 className="font-semibold">Encargos</h3>
                  <p className="text-xs text-muted-foreground">
                    FGTS, consignado, INSS e IRRF separados da folha.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 xl:grid-cols-3">
                {encargos.map((secao) => (
                  <TabelaRateio
                    key={secao.chave}
                    titulo={secao.titulo}
                    chave={secao.chave}
                    total={cnpj[secao.chave]}
                    detalhes={cnpj.detalhes}
                  />
                ))}
              </div>
            </section>

            <Card className="border-border/60 p-5 shadow-elegant">
              <h4 className="mb-4 font-semibold">Resumo final do CNPJ</h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Tomadores", cnpj.tomadores],
                  ["Colaboradores", cnpj.colaboradores],
                  ["Folha", formatarMoeda(cnpj.folha)],
                  ["FGTS + Consignado", formatarMoeda(cnpj.fgtsConsignado)],
                  ["INSS", formatarMoeda(cnpj.inss)],
                  ["IRRF", formatarMoeda(cnpj.irrf)],
                  ["Total geral", formatarMoeda(cnpj.totalGeral)],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border border-border bg-background p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
