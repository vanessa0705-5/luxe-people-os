import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FeriasFormSheet } from "@/components/ferias/ferias-form-sheet";
import { useAuth } from "@/lib/auth-context";
import {
  STATUS_FERIAS_LABELS,
  formatarData,
  listFeriasDoColaborador,
} from "@/lib/ferias-api";

export function FeriasColaboradorSection({ colaboradorId }: { colaboradorId: string }) {
  const { hasRole, isAdminPrincipal } = useAuth();
  const podeSolicitar = isAdminPrincipal || hasRole("rh") || hasRole("gestor");
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["ferias", "colaborador", colaboradorId],
    queryFn: () => listFeriasDoColaborador(colaboradorId),
  });

  const rows = query.data ?? [];
  const diasGozados = rows
    .filter((r) => r.status === "concluida" || r.status === "em_gozo")
    .reduce((acc, r) => acc + r.dias, 0);

  return (
    <Card className="border-border bg-card shadow-elegant">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">Férias</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {rows.length} período(s) registrado(s) · {diasGozados} dia(s) já usufruído(s)
          </p>
        </div>
        {podeSolicitar && (
          <Button
            size="sm"
            className="bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
            onClick={() => setOpen(true)}
          >
            <Plus className="mr-1 h-4 w-4" /> Nova solicitação
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <p className="py-6 text-center text-sm text-destructive">
            Não foi possível carregar as férias deste colaborador.
          </p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum período de férias registrado para este colaborador.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período de gozo</TableHead>
                <TableHead className="text-center">Dias</TableHead>
                <TableHead>Período aquisitivo</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">
                    {formatarData(r.data_inicio)} a {formatarData(r.data_fim)}
                  </TableCell>
                  <TableCell className="text-center text-sm">{r.dias}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.periodo_aquisitivo_inicio
                      ? `${formatarData(r.periodo_aquisitivo_inicio)} a ${formatarData(r.periodo_aquisitivo_fim)}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[11px]">
                      {STATUS_FERIAS_LABELS[r.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <FeriasFormSheet open={open} onOpenChange={setOpen} colaboradorIdFixo={colaboradorId} />
    </Card>
  );
}
