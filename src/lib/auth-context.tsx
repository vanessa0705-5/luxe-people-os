import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "admin_principal"
  | "rh"
  | "departamento_pessoal"
  | "seguranca_trabalho"
  | "gestor"
  | "consulta"
  | "visualizador";

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  job_title: string | null;
  is_active: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  isAdminPrincipal: boolean;
  isRateioOnly: boolean;
  canDelete: boolean;
  /** RH ou Admin Principal — gestão geral de pessoas. */
  canManageRh: boolean;
  /** Segurança do Trabalho, RH ou Admin Principal — ASO e NRs. */
  canManageSst: boolean;
  /** Departamento Pessoal, RH ou Admin Principal. */
  canManageDp: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // defer to avoid deadlock
        setTimeout(() => loadUserData(newSession.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadUserData(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  async function loadUserData(userId: string) {
    const [{ data: prof }, { data: rolesData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile(prof as Profile | null);
    setRoles((rolesData ?? []).map((r) => r.role as AppRole));
  }

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdminPrincipal = hasRole("admin_principal");
  const isRateioOnly = user?.email?.toLowerCase() === "claudineia.paz@sil.net.br";

  const value: AuthContextValue = {
    user,
    session,
    profile,
    roles,
    loading,
    hasRole,
    isAdminPrincipal,
    isRateioOnly,
    canDelete: isAdminPrincipal,
    canManageRh: isAdminPrincipal || hasRole("rh"),
    canManageSst:
        isAdminPrincipal ||
        hasRole("rh") ||
        hasRole("departamento_pessoal") ||
        hasRole("seguranca_trabalho"),
    canManageDp:
      isRateioOnly || isAdminPrincipal || hasRole("rh") || hasRole("departamento_pessoal"),
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin_principal: "Administrador Principal",
  rh: "RH",
  departamento_pessoal: "Departamento Pessoal",
  seguranca_trabalho: "Segurança do Trabalho",
  gestor: "Gestor",
  consulta: "Consulta",
  visualizador: "Visualizador",
};
