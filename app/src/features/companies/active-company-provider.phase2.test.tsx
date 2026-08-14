import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/http/api-client";
import { ActiveCompanyProvider, type Company, useActiveCompany } from "./active-company-provider";

const auth = vi.hoisted(() => ({ status: "authenticated" as string }));

vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({ status: auth.status, user: null }),
}));

function company(id: string): Company {
  return {
    id,
    name: id,
    timezone: "America/Sao_Paulo",
    settings: {},
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

let selectCompany: ((companyId: string) => void) | undefined;

function Probe() {
  const context = useActiveCompany();
  selectCompany = context.selectCompany;
  return (
    <div>
      <span data-testid="status">{context.status}</span>
      <span data-testid="active">{context.activeCompany?.id ?? "none"}</span>
      <span data-testid="error">{context.error?.message ?? "none"}</span>
    </div>
  );
}

function renderProvider() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ActiveCompanyProvider>
        <Probe />
      </ActiveCompanyProvider>
    </QueryClientProvider>,
  );
}

describe("ActiveCompanyProvider uncovered states", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    auth.status = "authenticated";
    selectCompany = undefined;
  });

  it.each(["initializing", "unauthenticated"])(
    "fica idle e não busca empresas quando auth está %s",
    (status) => {
      auth.status = status;
      localStorage.setItem("orbis:active-company-id", "company-a");
      const request = vi.spyOn(apiClient, "request");

      renderProvider();

      expect(screen.getByTestId("status")).toHaveTextContent("idle");
      expect(screen.getByTestId("active")).toHaveTextContent("none");
      expect(request).not.toHaveBeenCalled();
      expect(localStorage.getItem("orbis:active-company-id")).toBe(
        status === "unauthenticated" ? null : "company-a",
      );
    },
  );

  it("expõe erro da consulta e não seleciona empresa", async () => {
    vi.spyOn(apiClient, "request").mockRejectedValue(new Error("indisponível"));

    renderProvider();

    expect(await screen.findByText("error")).toBeInTheDocument();
    expect(screen.getByTestId("error")).toHaveTextContent("indisponível");
    expect(screen.getByTestId("active")).toHaveTextContent("none");
  });

  it("ignora rejeição que não seja Error no campo error", async () => {
    vi.spyOn(apiClient, "request").mockRejectedValue("falha");

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    expect(screen.getByTestId("error")).toHaveTextContent("none");
  });

  it("restaura uma empresa autorizada persistida entre múltiplas opções", async () => {
    localStorage.setItem("orbis:active-company-id", "company-b");
    vi.spyOn(apiClient, "request").mockResolvedValue([company("company-a"), company("company-b")]);

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("active")).toHaveTextContent("company-b"));
    expect(localStorage.getItem("orbis:active-company-id")).toBe("company-b");
  });

  it("rejeita seleção de empresa fora da lista autorizada", async () => {
    vi.spyOn(apiClient, "request").mockResolvedValue([company("company-a"), company("company-b")]);
    renderProvider();
    await screen.findByText("ready");

    expect(() => selectCompany?.("company-x")).toThrow("Empresa não autorizada");
    expect(localStorage.getItem("orbis:active-company-id")).toBeNull();
  });

  it("useActiveCompany falha fora do provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    function InvalidConsumer() {
      useActiveCompany();
      return null;
    }

    expect(() => render(<InvalidConsumer />)).toThrow(
      "useActiveCompany deve ser usado dentro de ActiveCompanyProvider",
    );
  });
});
