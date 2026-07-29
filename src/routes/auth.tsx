import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Lock, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Login — Gestão de RH" },
      { name: "description", content: "Acesso ao sistema interno de Gestão de RH." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Falha no login", { description: error.message });
      return;
    }
    toast.success("Bem-vindo(a)!");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-primary p-4">
      {/* Decoração */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
      </div>

      <div className="relative grid w-full max-w-5xl gap-8 lg:grid-cols-2">
        {/* Painel esquerdo — Branding */}
        <div className="hidden flex-col justify-between p-8 text-primary-foreground lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-gold shadow-gold">
              <Building2 className="h-5 w-5 text-gold-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">Gestão de RH</p>
              <p className="text-xs text-gold">Sistema Interno</p>
            </div>
          </div>

          <div>
            <h1 className="text-4xl font-semibold leading-tight text-primary-foreground">
              Gestão de Recursos Humanos <span className="text-gold">profissional</span>.
            </h1>
            <p className="mt-4 max-w-md text-sm text-primary-foreground/70">
              Plataforma unificada para colaboradores, empresas, tomadores, documentos, férias,
              movimentações e auditoria.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-primary-foreground/50">
            <span className="h-px w-8 bg-gold" />
            Uso interno · Acesso restrito
          </div>
        </div>

        {/* Painel direito — Formulário */}
        <Card className="border-border/50 bg-card p-8 shadow-elegant">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight">Acessar sistema</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Entre com suas credenciais corporativas.
            </p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="voce@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 bg-gradient-gold font-semibold shadow-gold hover:opacity-95"
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>

            <p className="mt-2 text-center text-xs text-muted-foreground">
              Acesso concedido pelo Administrador. Fale com o RH em caso de dúvidas.
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
