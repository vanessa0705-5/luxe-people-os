import type { ReactNode } from "react";

interface PageShellProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageShell({ title, description, icon, actions, children }: PageShellProps) {
  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-gold shadow-gold">
              {icon}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </header>
      <div>{children}</div>
    </div>
  );
}

export function EmptyModule({ message }: { message?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center shadow-elegant">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent">
        <span className="text-2xl">✨</span>
      </div>
      <h3 className="text-base font-medium text-foreground">Módulo pronto para expansão</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {message ??
          "A estrutura desta tela está preparada. As funcionalidades serão implementadas em etapas futuras."}
      </p>
    </div>
  );
}
