import { NavLink, Outlet } from "react-router-dom";
import { AppShell } from "@/app/layouts/app-shell";
import { useActiveCompany } from "@/features/companies/active-company-provider";
import type { CompanyCapability } from "@/features/companies/capabilities-contracts";
import { useCompanyCapabilities } from "@/features/companies/capabilities-queries";

export const ADMIN_NAV: Array<{ to: string; label: string; capability: CompanyCapability }> = [
  { to: "/admin/companies", label: "Empresas", capability: "company.read" },
  { to: "/admin/users", label: "Usuários", capability: "users.read" },
  { to: "/admin/requisitions", label: "Requisições", capability: "requisitions.read" },
  { to: "/admin/systems", label: "Sistemas", capability: "systems.read" },
  { to: "/admin/versions", label: "Versões", capability: "systems.read" },
  { to: "/admin/releases", label: "Releases", capability: "releases.read" },
  { to: "/admin/audit", label: "Auditoria", capability: "audit.read" },
];

export function AdminLayout() {
  const company = useActiveCompany();
  const companyId = company.activeCompany?.id ?? null;
  const capabilities = useCompanyCapabilities(companyId);
  if (company.status === "loading" || capabilities.isPending)
    return (
      <AppShell>
        <p aria-busy="true">Carregando administração...</p>
      </AppShell>
    );
  if (!companyId)
    return (
      <AppShell>
        <p>Selecione uma empresa para administrar.</p>
      </AppShell>
    );
  if (capabilities.isError)
    return (
      <AppShell>
        <p role="alert" className="text-destructive">
          Não foi possível validar suas permissões.
        </p>
      </AppShell>
    );
  const allowed = ADMIN_NAV.filter((item) => capabilities.data?.capabilities[item.capability]);
  if (allowed.length === 0)
    return (
      <AppShell>
        <p role="alert">Você não possui acesso administrativo nesta empresa.</p>
      </AppShell>
    );
  return (
    <AppShell>
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <aside>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Administração
          </p>
          <nav aria-label="Administração" className="flex gap-2 overflow-x-auto pb-2 lg:flex-col">
            {allowed.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-md px-3 py-2 text-sm ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <AdminContext companyId={companyId} capabilities={capabilities.data.capabilities} />
      </div>
    </AppShell>
  );
}

function AdminContext({
  companyId,
  capabilities,
}: {
  companyId: string;
  capabilities: Partial<Record<CompanyCapability, boolean>>;
}) {
  return (
    <main className="min-w-0">
      <Outlet context={{ companyId, capabilities }} />
    </main>
  );
}

export interface AdminOutletContext {
  companyId: string;
  capabilities: Partial<Record<CompanyCapability, boolean>>;
}
