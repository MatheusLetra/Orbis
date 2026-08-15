import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FormDialog, SelectField, State } from "./admin-ui";

describe("admin ui", () => {
  it("renderiza estados de carregamento, erro e vazio", () => {
    const view = render(
      <State pending error={false} empty={false}>
        ok
      </State>,
    );
    expect(screen.getByText("Carregando...")).toBeInTheDocument();
    view.rerender(
      <State pending={false} error empty={false}>
        ok
      </State>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    view.rerender(
      <State pending={false} error={false} empty>
        ok
      </State>,
    );
    expect(screen.getByText("Nenhum registro encontrado.")).toBeInTheDocument();
  });

  it("exibe erro sem submit e propaga seleção", () => {
    const change = vi.fn();
    render(
      <FormDialog
        open
        title="Teste"
        pending={false}
        error
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        submit={false}
      >
        <SelectField label="Opção" name="option" onChange={change}>
          <option value="a">A</option>
          <option value="b">B</option>
        </SelectField>
      </FormDialog>,
    );
    fireEvent.change(screen.getByLabelText("Opção"), { target: { value: "b" } });
    expect(change).toHaveBeenCalledWith("b");
    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
