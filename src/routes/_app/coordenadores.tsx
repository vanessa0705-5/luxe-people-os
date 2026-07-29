import { createFileRoute } from "@tanstack/react-router";
import { UserCog } from "lucide-react";
import { PageShell, EmptyModule } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/coordenadores")({
  head: () => ({
    meta: [
      { title: "Coordenadores — Gestão de RH" },
      { name: "description", content: "Gestão de coordenadores e responsáveis." },
    ],
  }),
  component: UserCogPage,
});

function UserCogPage() {
  const { canDelete } = useAuth();
  return (
    <PageShell
      title="Coordenadores"
      description="Gestão de coordenadores e responsáveis."
      icon={<UserCog className="h-5 w-5 text-gold-foreground" />}
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
