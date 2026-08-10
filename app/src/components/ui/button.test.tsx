import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renderiza um botão padrão", () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
  });

  it("renderiza como componente filho quando asChild é informado", () => {
    render(
      <Button asChild>
        <a href="/teste">Acessar página de teste</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Acessar página de teste" });
    expect(link).toBeInTheDocument();
    expect(link.tagName.toLowerCase()).toBe("a");
  });

  it("aplica variantes de tamanho", () => {
    render(<Button size="sm">Pequeno</Button>);
    expect(screen.getByRole("button", { name: "Pequeno" })).toHaveClass("h-8");
  });

  it("fica desabilitado quando disabled é informado", () => {
    render(<Button disabled>Desabilitado</Button>);
    expect(screen.getByRole("button", { name: "Desabilitado" })).toBeDisabled();
  });
});
