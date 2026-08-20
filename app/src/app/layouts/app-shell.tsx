import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-provider";
import { useActiveCompany } from "@/features/companies/active-company-provider";
import { NotificationCenter } from "@/features/notifications/notification-center";
import "./app-shell.css";

export function AppShell({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const company = useActiveCompany();

  return (
    <div className="app-shell flex min-h-dvh flex-col">
      <header className="app-shell-header">
        <div className="app-shell-header-inner">
          <div className="app-shell-brand-row">
            <span className="app-shell-brand">Orbis</span>
          </div>
          <div className="app-shell-controls">
            {company.companies.length > 1 && (
              <div className="app-shell-company-control">
                <label className="sr-only" htmlFor="active-company">
                  Empresa ativa
                </label>
                <select
                  id="active-company"
                  className="app-shell-company-select"
                  value={company.activeCompany?.id ?? ""}
                  title={company.activeCompany?.name ?? "Escolha a empresa"}
                  style={{ width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}
                  onChange={(event) => company.selectCompany(event.target.value)}
                >
                  <option value="" disabled>
                    Escolha a empresa
                  </option>
                  {company.companies.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="app-shell-actions">
              <Button asChild variant="ghost" size="sm">
                <a href="/chat">Chat</a>
              </Button>
              <NotificationCenter
                key={company.activeCompany?.id ?? "no-company"}
                companyId={company.activeCompany?.id ?? null}
              />
              <ThemeToggle />
              <Button variant="ghost" size="sm" onClick={() => void auth.logout()}>
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <nav
        aria-label="Navegação principal"
        className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2 text-sm sm:px-6 lg:px-8"
      >
        <a href="/" className="underline-offset-4 hover:underline">
          Início
        </a>
        <a href="/kanban" className="underline-offset-4 hover:underline">
          Tarefas
        </a>
        <a href="/timeline" className="underline-offset-4 hover:underline">
          Timeline
        </a>
        <a href="/reports" className="underline-offset-4 hover:underline">
          Relatórios
        </a>
        <button
          type="button"
          onClick={() => window.history.back()}
          aria-label="Voltar para a tela anterior"
          className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Voltar
        </button>
      </nav>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>

      <footer className="border-t py-4">
        <p className="px-4 text-center text-xs text-muted-foreground sm:px-6">
          Orbis — gestão de requisições e tarefas
        </p>
      </footer>
    </div>
  );
}
