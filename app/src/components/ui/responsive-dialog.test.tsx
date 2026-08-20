import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResponsiveDialog } from "./responsive-dialog";

afterEach(() => {
  document.body.style.overflow = "";
  Object.defineProperty(window, "visualViewport", {
    value: undefined,
    configurable: true,
  });
});

describe("ResponsiveDialog", () => {
  it("não renderiza nem bloqueia scroll quando fechado", () => {
    render(
      <ResponsiveDialog open={false} titleId="title" onClose={vi.fn()}>
        conteúdo
      </ResponsiveDialog>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("renderiza em portal, bloqueia scroll, foca o alvo e restaura overflow", async () => {
    const focusRef = createRef<HTMLButtonElement>();
    document.body.style.overflow = "scroll";
    const { unmount } = render(
      <ResponsiveDialog open titleId="dialog-title" initialFocusRef={focusRef} onClose={vi.fn()}>
        <h2 id="dialog-title">Editar</h2>
        <button ref={focusRef} type="button">
          Salvar
        </button>
      </ResponsiveDialog>,
    );

    expect(screen.getByRole("dialog", { name: "Editar" })).toHaveAttribute("aria-modal", "true");
    expect(document.body.style.overflow).toBe("hidden");
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar" })).toHaveFocus());
    unmount();
    expect(document.body.style.overflow).toBe("scroll");
  });

  it("fecha com Escape e mantém Tab preso entre primeiro e último foco", () => {
    const onClose = vi.fn();
    render(
      <ResponsiveDialog open titleId="title" onClose={onClose}>
        <h2 id="title">Dialog</h2>
        <button type="button">Primeiro</button>
        <button type="button">Último</button>
      </ResponsiveDialog>,
    );
    const dialog = screen.getByRole("dialog");
    const first = screen.getByRole("button", { name: "Primeiro" });
    const last = screen.getByRole("button", { name: "Último" });

    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(first).toHaveFocus();
    first.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("ignora Escape originado em outro diálogo portalizado", () => {
    const outerClose = vi.fn();
    const innerClose = vi.fn();
    render(
      <>
        <ResponsiveDialog open titleId="outer-title" onClose={outerClose}>
          <h2 id="outer-title">Outer</h2>
        </ResponsiveDialog>
        <ResponsiveDialog open titleId="inner-title" onClose={innerClose}>
          <h2 id="inner-title">Inner</h2>
          <button type="button">Inner control</button>
        </ResponsiveDialog>
      </>,
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "Inner control" }), { key: "Escape" });
    expect(outerClose).not.toHaveBeenCalled();
    expect(innerClose).toHaveBeenCalledOnce();
  });

  it("acompanha resize/scroll do visual viewport e remove listeners", () => {
    const listeners = new Map<string, () => void>();
    const viewport = {
      offsetLeft: 5,
      offsetTop: 10,
      width: 800,
      height: 600,
      addEventListener: vi.fn((type: string, listener: () => void) =>
        listeners.set(type, listener),
      ),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, "visualViewport", { value: viewport, configurable: true });
    const { unmount } = render(
      <ResponsiveDialog open titleId="title" onClose={vi.fn()}>
        <h2 id="title">Dialog</h2>
      </ResponsiveDialog>,
    );
    const backdrop = screen.getByTestId("responsive-dialog-backdrop");
    expect(backdrop).toHaveStyle({ left: "5px", top: "10px", width: "800px", height: "600px" });

    viewport.offsetTop = 40;
    viewport.height = 400;
    fireEvent(window, new Event("resize"));
    expect(backdrop).toHaveStyle({ top: "40px", height: "400px" });
    unmount();
    expect(viewport.removeEventListener).toHaveBeenCalledWith("resize", listeners.get("resize"));
    expect(viewport.removeEventListener).toHaveBeenCalledWith("scroll", listeners.get("scroll"));
  });

  it("ignora teclas sem navegação quando não há controles focáveis", () => {
    const onClose = vi.fn();
    render(
      <ResponsiveDialog open titleId="title" onClose={onClose}>
        <h2 id="title">Dialog</h2>
      </ResponsiveDialog>,
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Enter" });
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("fecha quando Escape é emitido fora do conteúdo do modal", () => {
    const onClose = vi.fn();
    render(
      <ResponsiveDialog open titleId="title" onClose={onClose}>
        <h2 id="title">Dialog</h2>
      </ResponsiveDialog>,
    );
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
