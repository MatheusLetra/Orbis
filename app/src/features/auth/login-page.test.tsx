import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/http/api-error";
import { LoginPage } from "./login-page";

const authState = vi.hoisted(() => ({
  login: vi.fn(),
}));

vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => authState,
}));
vi.mock("@/components/common/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Alternar tema</button>,
}));

function Destination() {
  const location = useLocation();
  return <p>Destino: {location.pathname}</p>;
}

function renderLogin(from?: string) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: "/login", state: from ? { from: { pathname: from } } : null }]}
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function submitCredentials() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("E-mail"), "user@orbis.test");
  await user.type(screen.getByLabelText("Senha"), "secret");
  await user.click(screen.getByRole("button", { name: "Entrar" }));
  return user;
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.login.mockResolvedValue(undefined);
  });

  it("renderiza a apresentação e o formulário de acesso", () => {
    renderLogin();

    expect(screen.getByRole("heading", { name: "Acesse sua conta" })).toBeInTheDocument();
    expect(screen.getByText("Trabalho, contexto e decisões no mesmo lugar.")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });

  it("autentica e redireciona para a rota de origem", async () => {
    renderLogin("/kanban");
    await submitCredentials();

    expect(authState.login).toHaveBeenCalledWith("user@orbis.test", "secret");
    expect(await screen.findByText("Destino: /kanban")).toBeInTheDocument();
  });

  it.each([undefined, "/login"])("redireciona para a raiz quando a origem é %s", async (from) => {
    renderLogin(from);
    await submitCredentials();

    expect(await screen.findByText("Destino: /")).toBeInTheDocument();
  });

  it("mostra a mensagem específica para credenciais inválidas", async () => {
    authState.login.mockRejectedValue(
      new ApiError({ status: 401, code: "UNAUTHORIZED", message: "Unauthorized" }),
    );
    renderLogin();
    await submitCredentials();

    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha inválidos.");
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });

  it("mostra erro de conexão para falhas não autenticadas", async () => {
    authState.login.mockRejectedValue(new TypeError("Failed to fetch"));
    renderLogin();
    await submitCredentials();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível entrar. Verifique sua conexão e tente novamente.",
    );
  });

  it("indica loading e desabilita os campos durante o login", async () => {
    let resolveLogin: (() => void) | undefined;
    authState.login.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveLogin = resolve;
      }),
    );
    renderLogin();
    await submitCredentials();

    expect(screen.getByRole("button", { name: "Entrando..." })).toBeDisabled();
    expect(screen.getByLabelText("E-mail")).toBeDisabled();
    expect(screen.getByLabelText("Senha")).toBeDisabled();

    resolveLogin?.();
    await waitFor(() => expect(screen.getByText("Destino: /")).toBeInTheDocument());
  });
});
