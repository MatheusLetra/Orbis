import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { LoadingState } from "./loading-state";

describe("server state primitives", () => {
  it("expõe loading acessível", () => {
    render(<LoadingState label="Carregando tarefas" />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando tarefas");
  });

  it("expõe erro e retry", () => {
    render(<ErrorState message="Falha" onRetry={() => undefined} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Falha");
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });

  it("expõe empty sem regra de domínio", () => {
    render(<EmptyState title="Nenhum resultado" description="Ajuste os filtros." />);
    expect(screen.getByRole("region", { name: "Nenhum resultado" })).toBeInTheDocument();
    expect(screen.getByText("Ajuste os filtros.")).toBeInTheDocument();
  });
});
