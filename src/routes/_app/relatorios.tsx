import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { PageShell, EmptyModule } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Gestão de RH" },
      { name: "description", content: "Relatórios gerenciais e indicadores de RH." },
    ],
  }),
  component: BarChart3Page,
});

function BarChart3Page() {
  const { canDelete } = useAuth();
  return (
    <PageShell
      title="Relatórios"
      description="Relatórios gerenciais e indicadores de RH."
      icon={<BarChart3 className="h-5 w-5 text-gold-foreground" />}
      actions={
        <>
          <Button variant="outline" className="border-border">
            Exportar
          </Button>
          <Button className="bg-gradient-gold font-semibold shadow-gold hover:opacity-95">
            <Plus className="mr-1 h-4 w-4" /> Novo
          </Button>
        </>
      }
    >
      <EmptyModule />
      {!canDelete && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Somente o Administrador Principal poderá excluir registros neste módulo.
        </p>
      )}
    </PageShell>
  );
}
