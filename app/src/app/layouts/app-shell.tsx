import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-provider";
import { useActiveCompany } from "@/features/companies/active-company-provider";

export function AppShell({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const company = useActiveCompany();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">Orbis</span>
          </div>
          <div className="flex items-center gap-2">
            {company.companies.length > 1 && (
              <label className="sr-only" htmlFor="active-company">
                Empresa ativa
              </label>
            )}
            {company.companies.length > 1 && (
              <select
                id="active-company"
                className="h-9 max-w-48 rounded-md border bg-background px-2 text-sm"
                value={company.activeCompany?.id ?? ""}
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
            )}
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => void auth.logout()}>
              Sair
            </Button>
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
