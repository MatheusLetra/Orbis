import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renderiza conteúdo opcional", () => {
    render(
      <EmptyState
        title="Vazio"
        description="Sem registros"
        action={<button type="button">Retry</button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "Vazio" })).toBeInTheDocument();
    expect(screen.getByText("Sem registros")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("permite ausência de descrição e ação", () => {
    render(<EmptyState title="Sem detalhes" />);
    expect(screen.getByRole("heading", { name: "Sem detalhes" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
