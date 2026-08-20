import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/http/api-error";
import { createQueryClient } from "@/lib/query/query-client";
import { IdLookupField, type LookupDefinition } from "./id-lookup-field";

function renderField(
  lookup: LookupDefinition,
  value = "",
  initialItems = [{ id: "user-a", label: "Ana" }],
) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <IdLookupField
        label="Responsável"
        value={value}
        displayValue={value === "user-a" ? "Ana" : null}
        lookup={lookup}
        initialItems={initialItems}
        onChange={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

function lookup(search: LookupDefinition["search"]): LookupDefinition {
  return {
    entity: "member-test",
    companyId: "company-a",
    capability: "users.read",
    queryKey: (term) => ["lookup", "members", "company-a", "users.read", term],
    search,
  };
}

describe("IdLookupField", () => {
  it("abre com foco na busca, busca por teclado, seleciona e restaura foco", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const search = vi.fn().mockResolvedValue({
      items: [{ id: "user-b", label: "Bruno", description: "Desenvolvedor" }],
      nextCursor: null,
    });
    const definition = lookup(search);
    render(
      <QueryClientProvider client={createQueryClient()}>
        <IdLookupField
          label="Responsável"
          value=""
          displayValue={null}
          lookup={definition}
          onChange={onChange}
        />
      </QueryClientProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Buscar responsável" });
    await user.click(trigger);
    await waitFor(() => expect(screen.getByLabelText("Busca")).toHaveFocus());
    expect(search).toHaveBeenCalledWith({ search: "" }, { signal: expect.any(AbortSignal) });
    expect(definition.queryKey("")).toEqual(["lookup", "members", "company-a", "users.read", ""]);

    await user.type(screen.getByLabelText("Busca"), "Bru");
    await screen.findByRole("option", { name: /Bruno/ });
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith({
      id: "user-b",
      label: "Bruno",
      description: "Desenvolvedor",
    });
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("trata loading, vazio e paginação por cursor", async () => {
    const user = userEvent.setup();
    let resolve: ((value: { items: never[]; nextCursor: string | null }) => void) | undefined;
    const search = vi.fn().mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    renderField(lookup(search), "", []);
    await user.click(screen.getByRole("button", { name: "Buscar responsável" }));
    expect(screen.getByRole("status")).toHaveTextContent("Carregando");
    resolve?.({ items: [], nextCursor: "cursor-1" });
    await waitFor(() =>
      expect(screen.getByText("Nenhum registro encontrado.")).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Carregar mais" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Carregar mais" }));
    expect(search).toHaveBeenLastCalledWith(
      { search: "", cursor: "cursor-1" },
      { signal: expect.any(AbortSignal) },
    );
  });

  it("mostra erro e permite retry", async () => {
    const user = userEvent.setup();
    const search = vi
      .fn()
      .mockRejectedValueOnce(new ApiError({ status: 400, code: "BAD_REQUEST", message: "falha" }))
      .mockResolvedValueOnce({ items: [{ id: "user-a", label: "Ana" }], nextCursor: null });
    renderField(lookup(search));
    await user.click(screen.getByRole("button", { name: "Buscar responsável" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(screen.getByRole("option", { name: "Ana" })).toBeInTheDocument());
  });

  it("navega entre opções com as setas e não seleciona registro desabilitado", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const search = vi.fn().mockResolvedValue({
      items: [
        { id: "user-a", label: "Ana" },
        { id: "user-b", label: "Bruno" },
        { id: "user-c", label: "Carlos", disabled: true },
      ],
      nextCursor: null,
    });
    render(
      <QueryClientProvider client={createQueryClient()}>
        <IdLookupField
          label="Responsável"
          value=""
          displayValue={null}
          lookup={lookup(search)}
          onChange={onChange}
        />
      </QueryClientProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Buscar responsável" }));
    const options = await screen.findAllByRole("option");
    expect(screen.getByRole("option", { name: "Carlos" })).toBeDisabled();
    options[0]?.focus();
    await user.keyboard("{ArrowDown}{ArrowUp}{Enter}");
    expect(onChange).toHaveBeenCalledWith({ id: "user-a", label: "Ana" });
  });

  it("cancela sem alterar o valor e limpa a seleção", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <QueryClientProvider client={createQueryClient()}>
        <IdLookupField
          label="Responsável"
          value="user-a"
          displayValue="Ana"
          initialItems={[{ id: "user-a", label: "Ana" }]}
          onChange={onChange}
        />
      </QueryClientProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Limpar responsável" }));
    expect(onChange).toHaveBeenCalledWith(null);
    await user.click(screen.getByRole("button", { name: "Buscar responsável" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("não abre lookup sem adapter e mantém o campo manual", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <QueryClientProvider client={createQueryClient()}>
        <IdLookupField label="Responsável" value="seed" displayValue="Seed" onChange={onChange} />
      </QueryClientProvider>,
    );
    expect(screen.queryByRole("button", { name: "Buscar responsável" })).toBeDisabled();
    expect(screen.getByLabelText("Responsável ID")).toBeEnabled();
    await user.type(screen.getByLabelText("Responsável ID"), "user-a");
    expect(onChange).toHaveBeenCalled();
    const input = screen.getByLabelText("Responsável ID");
    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("ignora teclas sem ação na opção", async () => {
    const user = userEvent.setup();
    const search = vi.fn().mockResolvedValue({
      items: [{ id: "user-a", label: "Ana" }],
      nextCursor: null,
    });
    renderField(lookup(search));
    await user.click(screen.getByRole("button", { name: "Buscar responsável" }));
    const option = await screen.findByRole("option", { name: "Ana" });
    option.focus();
    await user.keyboard("{Home}");
    expect(option).toHaveFocus();
  });

  it("desabilita ações enquanto o campo está bloqueado", () => {
    const search = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
    render(
      <QueryClientProvider client={createQueryClient()}>
        <IdLookupField
          label="Responsável"
          value="user-a"
          displayValue="Ana"
          lookup={lookup(search)}
          disabled
          onChange={vi.fn()}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByRole("button", { name: "Buscar responsável" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Limpar responsável" })).toBeDisabled();
  });
});
