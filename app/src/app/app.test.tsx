import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "@/app/app";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { ThemeProvider } from "@/hooks/use-theme";

describe("ThemeToggle", () => {
  it("alterna o tema ao clicar", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const button = screen.getByRole("button", { name: "Alternar tema" });
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    await user.click(button);
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await user.click(button);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("persiste a preferência no localStorage", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Alternar tema" }));

    const saved = JSON.parse(window.localStorage.getItem("orbis:appearance") ?? "{}") as {
      theme: string;
    };
    expect(saved.theme).toBe("dark");
  });
});

describe("AppShell", () => {
  it("renderiza o shell com cabeçalho, conteúdo e rodapé", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(screen.getByRole("button", { name: "Alternar tema" })).toBeInTheDocument();
  });
});

describe("App", () => {
  it("renderiza a página inicial do Orbis", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Bem-vindo ao Orbis" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Plataforma multiempresa para gestão de requisições, tarefas, capacidade da equipe, Kanban e timelines.",
      ),
    ).toBeInTheDocument();
  });
});
