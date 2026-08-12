import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/http/api-client";
import { AuthProvider, useAuth } from "./auth-provider";

function accessToken(subject = "user-1"): string {
  return `header.${btoa(JSON.stringify({ sub: subject })).replace(/=/g, "")}.signature`;
}

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span>{auth.status}</span>
      <span>{auth.user?.id}</span>
      <button type="button" onClick={() => void auth.login("ana@orbis.io", "senha")}>
        login
      </button>
      <button type="button" onClick={() => void auth.logout()}>
        logout
      </button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    apiClient.setAccessToken(null);
    vi.spyOn(apiClient, "onSessionLost").mockReturnValue(() => undefined);
  });

  it("mantém initializing e restaura a sessão por refresh cookie", async () => {
    let resolveRefresh: (token: string) => void = () => undefined;
    vi.spyOn(apiClient, "refresh").mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
    );
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByText("initializing")).toBeInTheDocument();

    await act(async () => resolveRefresh(accessToken("restored-user")));
    expect(await screen.findByText("authenticated")).toBeInTheDocument();
    expect(screen.getByText("restored-user")).toBeInTheDocument();
  });

  it("fica unauthenticated quando o cookie está ausente ou inválido", async () => {
    vi.spyOn(apiClient, "refresh").mockRejectedValue(new Error("sem sessão"));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText("unauthenticated")).toBeInTheDocument();
  });

  it("faz login mantendo somente o access token em memória", async () => {
    vi.spyOn(apiClient, "refresh").mockRejectedValue(new Error("sem sessão"));
    vi.spyOn(apiClient, "request").mockResolvedValue({
      accessToken: "access-only",
      user: { id: "user-1", email: "ana@orbis.io", name: "Ana" },
    });
    const localSet = vi.spyOn(localStorage, "setItem");
    const sessionSet = vi.spyOn(sessionStorage, "setItem");
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText("unauthenticated");

    await act(async () => screen.getByRole("button", { name: "login" }).click());
    expect(await screen.findByText("authenticated")).toBeInTheDocument();
    expect(apiClient.getAccessToken()).toBe("access-only");
    expect(localSet).not.toHaveBeenCalled();
    expect(sessionSet).not.toHaveBeenCalled();
  });

  it("limpa a sessão local mesmo quando o logout remoto falha", async () => {
    vi.spyOn(apiClient, "refresh").mockResolvedValue(accessToken());
    vi.spyOn(apiClient, "request").mockRejectedValue(new TypeError("rede indisponível"));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText("authenticated");

    await act(async () => screen.getByRole("button", { name: "logout" }).click());
    expect(await screen.findByText("unauthenticated")).toBeInTheDocument();
    expect(apiClient.getAccessToken()).toBeNull();
  });
});
