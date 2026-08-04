import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MovimentacaoFormSheet } from "@/components/movimentacoes/movimentacao-form-sheet";
import { useAuth } from "@/lib/auth-context";
import {
  TIPO_MOV_LABELS,
  formatarData,
  listMovimentacoesDoColaborador,
  resumirMudanca,
} from "@/lib/movimentacoes-api";

export function MovimentacoesColaboradorSection({ colaboradorId }: { colaboradorId: string }) {
  const { hasRole, isAdminPrincipal } = useAuth();
  const podeRegistrar = isAdminPrincipal || hasRole("rh");
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["movimentacoes", "colaborador", colaboradorId],
    queryFn: () => listMovimentacoesDoColaborador(colaboradorId),
  });

  const rows = query.data ?? [];

  return (
    <Card className="border-border bg-card shadow-elegant">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">Movimentações</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {rows.length} movimentação(ões) registrada(s)
          </p>
        </div>
        {podeRegistrar && (
          <Button
            size="sm"
            className="bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
            onClick={() => setOpen(true)}
          >
            <Plus className="mr-1 h-4 w-4" /> Nova movimentação
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <p className="py-6 text-center text-sm text-destructive">
            Não foi possível carregar as movimentações deste colaborador.
          </p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma movimentação registrada para este colaborador.
          </p>
        ) : (
          <ol className="relative flex flex-col gap-4 border-l border-border pl-5">
            {rows.map((m) => (
              <li key={m.id} className="relative">
                <span
                  aria-hidden
                  className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-gradient-gold"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[11px]">
                    {TIPO_MOV_LABELS[m.tipo]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatarData(m.data_efeito)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-foreground">{resumirMudanca(m)}</p>
                {m.motivo && (
                  <p className="mt-0.5 text-xs text-muted-foreground">Motivo: {m.motivo}</p>
                )}
                {m.observacoes && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{m.observacoes}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>

      <MovimentacaoFormSheet
        open={open}
        onOpenChange={setOpen}
        colaboradorIdFixo={colaboradorId}
      />
    </Card>
  );
}
