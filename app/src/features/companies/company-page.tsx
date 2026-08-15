import { Link } from "react-router-dom";
import { AppShell } from "@/app/layouts/app-shell";
import { CapacitySimulationPanel } from "@/features/capacity/capacity-simulation-panel";
import { useActiveCompany } from "@/features/companies/active-company-provider";
import { useCompanyCapabilities } from "@/features/companies/capabilities-queries";

export function CompanyPage() {
  const company = useActiveCompany();
  const capabilities = useCompanyCapabilities(company.activeCompany?.id ?? null);
  const canOpenAdmin = [
    "company.read",
    "users.read",
    "requisitions.read",
    "systems.read",
    "releases.read",
    "audit.read",
  ].some(
    (capability) =>
      capabilities.data?.capabilities[capability as keyof typeof capabilities.data.capabilities],
  );

  if (company.status === "loading" || company.status === "idle") {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground" aria-busy="true">
          Carregando empresas...
        </p>
      </AppShell>
    );
  }

  if (company.status === "error") {
    return (
      <AppShell>
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar suas empresas.
        </p>
      </AppShell>
    );
  }

  if (company.companies.length === 0) {
    return (
      <AppShell>
        <p>Você não possui empresas disponíveis.</p>
      </AppShell>
    );
  }

  if (!company.activeCompany) {
    return (
      <AppShell>
        <section className="mx-auto max-w-xl space-y-6 py-12">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Escolha uma empresa</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Seu contexto de trabalho será isolado pela empresa selecionada.
            </p>
          </div>
          <div className="grid gap-3">
            {company.companies.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => company.selectCompany(item.id)}
                className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="font-medium">{item.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{item.timezone}</span>
              </button>
            ))}
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-5xl py-12 sm:py-20">
        <p className="text-sm text-muted-foreground">Contexto ativo</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{company.activeCompany.name}</h1>
        <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
          Acompanhe o trabalho da empresa por status no board de tarefas.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            to="/kanban"
          >
            Abrir board
          </Link>
          <Link
            className="inline-flex min-h-11 items-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            to="/timeline"
          >
            Abrir timeline
          </Link>
          {canOpenAdmin && (
            <Link
              className="inline-flex min-h-11 items-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              to="/admin"
            >
              Administração
            </Link>
          )}
        </div>
        <CapacitySimulationPanel
          key={company.activeCompany.id}
          companyId={company.activeCompany.id}
          capabilities={capabilities.data}
          onCapabilitiesForbidden={() => void capabilities.refetch()}
        />
      </section>
    </AppShell>
  );
}
