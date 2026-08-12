import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/http/api-client";
import { createQueryClient } from "@/lib/query/query-client";
import { ActiveCompanyProvider, type Company, useActiveCompany } from "./active-company-provider";

vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({ status: "authenticated", user: { id: "user-1" } }),
}));

function company(id: string, name: string): Company {
  return {
    id,
    name,
    timezone: "America/Sao_Paulo",
    settings: {},
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function Probe() {
  const context = useActiveCompany();
  return (
    <div>
      <span>{context.status}</span>
      <span>{context.activeCompany?.name ?? "nenhuma"}</span>
      <span>{context.companies.map((item) => item.name).join(",")}</span>
      <button type="button" onClick={() => context.selectCompany("company-2")}>
        selecionar segunda
      </button>
    </div>
  );
}

describe("ActiveCompanyProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  function renderProvider() {
    return render(
      <QueryClientProvider client={createQueryClient()}>
        <ActiveCompanyProvider>
          <Probe />
        </ActiveCompanyProvider>
      </QueryClientProvider>,
    );
  }

  it("carrega a lista autorizada e seleciona automaticamente empresa única", async () => {
    vi.spyOn(apiClient, "request").mockResolvedValue([company("company-1", "Orbis")]);
    renderProvider();
    await waitFor(() => expect(localStorage.getItem("orbis:active-company-id")).toBe("company-1"));
    expect(screen.getAllByText("Orbis")).toHaveLength(2);
  });

  it("exige seleção explícita com múltiplas empresas e permite a troca", async () => {
    vi.spyOn(apiClient, "request").mockResolvedValue([
      company("company-1", "Alpha"),
      company("company-2", "Beta"),
    ]);
    renderProvider();
    await screen.findByText("ready");
    expect(screen.getByText("nenhuma")).toBeInTheDocument();

    await act(async () => screen.getByRole("button", { name: "selecionar segunda" }).click());
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(localStorage.getItem("orbis:active-company-id")).toBe("company-2");
  });

  it("rejeita empresa persistida stale", async () => {
    localStorage.setItem("orbis:active-company-id", "sem-acesso");
    vi.spyOn(apiClient, "request").mockResolvedValue([
      company("company-1", "Alpha"),
      company("company-2", "Beta"),
    ]);
    renderProvider();
    await screen.findByText("ready");
    expect(screen.getByText("nenhuma")).toBeInTheDocument();
    expect(localStorage.getItem("orbis:active-company-id")).toBeNull();
  });

  it("remonta o subtree ao trocar tenant", async () => {
    vi.spyOn(apiClient, "request").mockResolvedValue([
      company("company-1", "Alpha"),
      company("company-2", "Beta"),
    ]);
    localStorage.setItem("orbis:active-company-id", "company-1");
    let mounts = 0;
    function TenantState() {
      const context = useActiveCompany();
      const [mount] = useState(() => ++mounts);
      return (
        <button type="button" onClick={() => context.selectCompany("company-2")}>
          {context.activeCompany?.name}:{mount}
        </button>
      );
    }
    render(
      <QueryClientProvider client={createQueryClient()}>
        <ActiveCompanyProvider>
          <TenantState />
        </ActiveCompanyProvider>
      </QueryClientProvider>,
    );
    const alpha = await screen.findByRole("button", { name: /Alpha:/ });
    const firstMount = Number(alpha.textContent?.split(":")[1]);
    await act(async () => alpha.click());
    const beta = await screen.findByRole("button", { name: /Beta:/ });
    expect(Number(beta.textContent?.split(":")[1])).toBeGreaterThan(firstMount);
  });
});
