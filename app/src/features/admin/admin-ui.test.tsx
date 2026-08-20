import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/http/api-error";
import { FormDialog, messageForAdminError, SelectField, State } from "./admin-ui";

describe("admin ui", () => {
  it("traduz erros HTTP administrativos sem apagar o contexto", () => {
    expect(
      messageForAdminError(new ApiError({ status: 400, code: "BAD", message: "Dados inválidos" })),
    ).toBe("Dados inválidos");
    expect(
      messageForAdminError(
        new ApiError({ status: 422, code: "INVALID", message: "Dados inválidos" }),
      ),
    ).toBe("Dados inválidos");
    expect(
      messageForAdminError(new ApiError({ status: 403, code: "FORBIDDEN", message: "x" })),
    ).toContain("permissão");
    expect(
      messageForAdminError(new ApiError({ status: 404, code: "NOT_FOUND", message: "x" })),
    ).toContain("não foi encontrado");
    expect(
      messageForAdminError(new ApiError({ status: 409, code: "CONFLICT", message: "x" })),
    ).toContain("conflito");
    expect(
      messageForAdminError(new ApiError({ status: 500, code: "ERROR", message: "x" })),
    ).toContain("API");
    expect(
      messageForAdminError(new ApiError({ status: 401, code: "UNAUTHORIZED", message: "x" })),
    ).toContain("conexão");
    expect(messageForAdminError(new Error("network"))).toContain("conexão");
  });
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

  it("permite repetir uma leitura que falhou", () => {
    const retry = vi.fn();
    render(
      <State pending={false} error empty={false} retry={retry}>
        ok
      </State>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(retry).toHaveBeenCalledOnce();
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
