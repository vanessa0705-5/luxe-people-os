import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Building2,
  Factory,
  UserCog,
  FolderOpen,
  HeartPulse,
  ShieldCheck,
  Palmtree,
  Repeat,
  UserMinus,
  BarChart3,
  Settings,
  ScrollText,
  LogOut,
  WalletCards,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth, ROLE_LABELS } from "@/lib/auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Colaboradores", url: "/colaboradores", icon: Users },
  { title: "Empresas (CNPJs)", url: "/empresas", icon: Building2 },
  { title: "Tomadores", url: "/tomadores", icon: Factory },
  { title: "Coordenadores", url: "/coordenadores", icon: UserCog },
  { title: "Documentos", url: "/documentos", icon: FolderOpen },
  { title: "ASO", url: "/aso", icon: HeartPulse },
  { title: "NRs", url: "/nrs", icon: ShieldCheck },
  { title: "Férias", url: "/ferias", icon: Palmtree },
  { title: "Movimentações", url: "/movimentacoes", icon: Repeat },
  { title: "Desligados", url: "/desligados", icon: UserMinus },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
] as const;

const financeItems = [
  { title: "Rateio de Folha", url: "/rateio-folha", icon: WalletCards },
] as const;

const adminItems = [
  { title: "Administração", url: "/administracao", icon: Settings },
  { title: "Auditoria", url: "/auditoria", icon: ScrollText },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { profile, roles, signOut, canManageDp, isRateioOnly } = useAuth();

  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");

  const initials = (profile?.full_name || profile?.email || "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const renderItems = (items: readonly { title: string; url: string; icon: typeof Users }[]) => (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.url}>
          <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
            <Link to={item.url}>
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gradient-gold text-sm font-bold shadow-gold">
            RH
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-sidebar-foreground">Gestão de RH</span>
              <span className="text-[10px] uppercase tracking-wider text-gold">
                Sistema Interno
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {!isRateioOnly && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel>Módulos</SidebarGroupLabel>}
            <SidebarGroupContent>{renderItems(mainItems)}</SidebarGroupContent>
          </SidebarGroup>
        )}

        {canManageDp && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel>Financeiro</SidebarGroupLabel>}
            <SidebarGroupContent>{renderItems(financeItems)}</SidebarGroupContent>
          </SidebarGroup>
        )}

        {!isRateioOnly && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel>Sistema</SidebarGroupLabel>}
            <SidebarGroupContent>{renderItems(adminItems)}</SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border border-gold/30">
            <AvatarFallback className="bg-sidebar-accent text-xs font-semibold text-gold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-xs font-medium text-sidebar-foreground">
                {profile?.full_name || profile?.email || "Usuário"}
              </span>
              <span className="truncate text-[10px] text-gold">
                {roles[0] ? ROLE_LABELS[roles[0]] : "Sem perfil"}
              </span>
            </div>
          )}
          <button
            onClick={() => signOut()}
            className="rounded-md p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-gold"
            title="Sair"
            aria-label="Sair do sistema"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
