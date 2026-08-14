import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-provider";
import { useActiveCompany } from "@/features/companies/active-company-provider";
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
              <ThemeToggle />
              <Button variant="ghost" size="sm" onClick={() => void auth.logout()}>
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>

      <footer className="border-t py-4">
        <p className="px-4 text-center text-xs text-muted-foreground sm:px-6">
          Orbis — gestão de requisições e tarefas
        </p>
      </footer>
    </div>
  );
}
