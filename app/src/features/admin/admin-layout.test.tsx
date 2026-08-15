import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminLayout } from "./admin-layout";

const state = {
  companyStatus: "ready",
  companyId: "company-a" as string | null,
  pending: false,
  error: false,
  capabilities: { "company.read": true } as Record<string, boolean>,
};
vi.mock("@/app/layouts/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/features/companies/active-company-provider", () => ({
  useActiveCompany: () => ({
    status: state.companyStatus,
    activeCompany: state.companyId ? { id: state.companyId } : null,
  }),
}));
vi.mock("@/features/companies/capabilities-queries", () => ({
  useCompanyCapabilities: () => ({
    isPending: state.pending,
    isError: state.error,
    data: { capabilities: state.capabilities },
  }),
}));

const mount = () =>
  render(
    <MemoryRouter initialEntries={["/admin/companies"]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="companies" element={<p>Conteúdo</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

describe("AdminLayout", () => {
  beforeEach(() => {
    state.companyStatus = "ready";
    state.companyId = "company-a";
    state.pending = false;
    state.error = false;
    state.capabilities = { "company.read": true };
  });
  it("renderiza navegação permitida e outlet", () => {
    mount();
    expect(screen.getByRole("navigation", { name: "Administração" })).toBeInTheDocument();
    expect(screen.getByText("Conteúdo")).toBeInTheDocument();
  });
  it("trata carregamento, tenant ausente, erro e ausência de acesso", () => {
    state.pending = true;
    const first = mount();
    expect(screen.getByText("Carregando administração...")).toBeInTheDocument();
    first.unmount();
    state.pending = false;
    state.companyId = null;
    const second = mount();
    expect(screen.getByText("Selecione uma empresa para administrar.")).toBeInTheDocument();
    second.unmount();
    state.companyId = "company-a";
    state.error = true;
    const third = mount();
    expect(screen.getByRole("alert")).toHaveTextContent("validar");
    third.unmount();
    state.error = false;
    state.capabilities = {};
    mount();
    expect(screen.getByRole("alert")).toHaveTextContent("não possui acesso");
  });
});
