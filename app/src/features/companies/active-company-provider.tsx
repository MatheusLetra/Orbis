import { useQuery } from "@tanstack/react-query";
import { createContext, use, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { apiClient } from "@/lib/http/api-client";

export interface Company {
  id: string;
  name: string;
  timezone: string;
  settings: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type CompaniesStatus = "idle" | "loading" | "ready" | "error";

interface ActiveCompanyContextValue {
  companies: Company[];
  activeCompany: Company | null;
  status: CompaniesStatus;
  error: Error | null;
  selectCompany: (companyId: string) => void;
}

const STORAGE_KEY = "orbis:active-company-id";
const companyKeys = {
  all: ["companies"] as const,
  list: () => [...companyKeys.all, "list"] as const,
};
const ActiveCompanyContext = createContext<ActiveCompanyContextValue | null>(null);

export function ActiveCompanyProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const companiesQuery = useQuery({
    queryKey: companyKeys.list(),
    queryFn: ({ signal }) => apiClient.request<Company[]>("/companies", { signal }),
    enabled: auth.status === "authenticated",
  });
  const companies = companiesQuery.data ?? [];
  const status: CompaniesStatus =
    auth.status !== "authenticated"
      ? "idle"
      : companiesQuery.isPending
        ? "loading"
        : companiesQuery.isError
          ? "error"
          : "ready";
  const error = companiesQuery.error instanceof Error ? companiesQuery.error : null;

  useEffect(() => {
    let active = true;
    if (auth.status !== "authenticated") {
      setActiveCompany(null);
      if (auth.status === "unauthenticated") localStorage.removeItem(STORAGE_KEY);
      return;
    }
    if (companiesQuery.isPending || companiesQuery.isError) return;
    const storedId = localStorage.getItem(STORAGE_KEY);
    const stored = companies.find((company) => company.id === storedId) ?? null;
    const selected = stored ?? (companies.length === 1 ? (companies[0] ?? null) : null);
    if (!active) return;
    setActiveCompany(selected);
    if (selected) localStorage.setItem(STORAGE_KEY, selected.id);
    else localStorage.removeItem(STORAGE_KEY);
    return () => {
      active = false;
    };
  }, [auth.status, companies, companiesQuery.isError, companiesQuery.isPending]);

  function selectCompany(companyId: string): void {
    const selected = companies.find((company) => company.id === companyId);
    if (!selected) throw new Error("Empresa não autorizada");
    setActiveCompany(selected);
    localStorage.setItem(STORAGE_KEY, selected.id);
  }

  return (
    <ActiveCompanyContext value={{ companies, activeCompany, status, error, selectCompany }}>
      <div key={activeCompany?.id ?? "no-company"}>{children}</div>
    </ActiveCompanyContext>
  );
}

export function useActiveCompany(): ActiveCompanyContextValue {
  const context = use(ActiveCompanyContext);
  if (!context) throw new Error("useActiveCompany deve ser usado dentro de ActiveCompanyProvider");
  return context;
}
