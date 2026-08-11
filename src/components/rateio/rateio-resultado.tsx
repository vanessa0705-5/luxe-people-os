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
  const prolabore = resultado.resumo.prolabore ?? 0;
  const totalArquivo = resultado.resumo.totalArquivo ?? resultado.resumo.totalGeral;
  const consolidado = new Map<string, { tomador: string; colaboradores: number; valor: number }>();

  for (const cnpj of resultado.cnpjs) {
    for (const item of cnpj.detalhes) {
      const chave = item.tomador.trim().toLocaleLowerCase("pt-BR");
      const atual = consolidado.get(chave) ?? {
        tomador: item.tomador,
        colaboradores: 0,
        valor: 0,
      };
      atual.colaboradores += item.colaboradores;
      atual.valor +=
        modo === "folha"
          ? item.folha
          : modo === "encargos"
            ? item.fgtsConsignado + item.inss + item.irrf
            : item.totalGeral;
      consolidado.set(chave, atual);
    }
  }

  const rateios = Array.from(consolidado.values()).sort((a, b) =>
    a.tomador.localeCompare(b.tomador, "pt-BR"),
  );
  const totalRateado = rateios.reduce((acc, item) => acc + item.valor, 0);
  const indicadores: Array<[string, string | number]> = [
    ["Empresas", resultado.resumo.empresas],
    ["Tomadores", resultado.resumo.tomadores],
    ["Colaboradores", resultado.resumo.colaboradores],
    [mostrarFolha ? "Total completo da folha" : "Total geral", formatarMoeda(mostrarFolha ? totalArquivo : resultado.resumo.totalGeral)],
  ];

  return (
    <div className="space-y-5">
      <Card className="border-gold/25 bg-accent/20 p-5 shadow-elegant">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gradient-gold p-2">
            <ReceiptText className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold">Resumo do rateio</h2>
            <p className="text-sm text-muted-foreground">
              Confira os valores e as quantidades antes de finalizar ou baixar o Excel.
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
          {mostrarFolha ? (
            <>
              <TotalCard label="Total rateado" value={totalRateado} />
              <TotalCard label="Pró-labore (fora do rateio)" value={prolabore} />
              <TotalCard label="Total completo da folha" value={totalArquivo} destaque />
            </>
          ) : (
            <>
              <TotalCard label="FGTS + Consignado" value={resultado.resumo.fgtsConsignado} />
              <TotalCard label="INSS" value={resultado.resumo.inss} />
              <TotalCard label="IRRF" value={resultado.resumo.irrf} />
              <TotalCard label="Total geral" value={resultado.resumo.totalGeral} destaque />
            </>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden border-border/60 shadow-elegant">
        <div className="border-b border-border px-5 py-4">
          <h3 className="font-semibold">Rateios por tomador</h3>
          <p className="text-xs text-muted-foreground">
            Este é o mesmo resumo que será levado para a planilha.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3">Tomador</th>
                <th className="px-5 py-3 text-center">Quantidade de colaboradores</th>
                <th className="px-5 py-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rateios.map((item) => (
                <tr key={item.tomador} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-3 font-medium">{item.tomador}</td>
                  <td className="px-5 py-3 text-center">{item.colaboradores}</td>
                  <td className="px-5 py-3 text-right font-medium">{formatarMoeda(item.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gold/30 bg-accent/20 font-semibold">
                <td className="px-5 py-3">Total rateado</td>
                <td className="px-5 py-3 text-center">{resultado.resumo.colaboradores}</td>
                <td className="px-5 py-3 text-right">{formatarMoeda(totalRateado)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}

function TotalCard({
  label,
  value,
  destaque = false,
}: {
  label: string;
  value: number;
  destaque?: boolean;
}) {
  return (
    <div
      className={
        "rounded-lg border p-4 " +
        (destaque ? "border-gold/30 bg-accent/25" : "border-border bg-background")
      }
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={"mt-1 text-lg font-semibold " + (destaque ? "text-gold" : "")}>
        {formatarMoeda(value)}
      </p>
    </div>
  );
}
