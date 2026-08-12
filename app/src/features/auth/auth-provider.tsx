import { createContext, use, useEffect, useState } from "react";
import { apiClient } from "@/lib/http/api-client";

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
}

type AuthStatus = "initializing" | "authenticated" | "unauthenticated";

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function subjectFromAccessToken(token: string): string {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("Access token inválido");
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const normalized = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const decoded = JSON.parse(atob(normalized)) as { sub?: string };
  if (!decoded.sub) throw new Error("Access token sem subject");
  return decoded.sub;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("initializing");
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let active = true;
    const clearSession = () => {
      if (!active) return;
      setUser(null);
      setStatus("unauthenticated");
    };
    const unsubscribe = apiClient.onSessionLost(clearSession);
    void apiClient
      .refresh()
      .then((token) => {
        if (!active) return;
        setUser({ id: subjectFromAccessToken(token) });
        setStatus("authenticated");
      })
      .catch(clearSession);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const output = await apiClient.request<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      authenticated: false,
    });
    apiClient.setAccessToken(output.accessToken);
    setUser(output.user);
    setStatus("authenticated");
  }

  async function logout(): Promise<void> {
    try {
      await apiClient.request<void>("/auth/logout", { method: "POST", authenticated: false });
    } catch {
      // Local credentials are still removed when the API cannot be reached.
    } finally {
      apiClient.setAccessToken(null);
      setUser(null);
      setStatus("unauthenticated");
    }
  }

  return <AuthContext value={{ status, user, login, logout }}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return context;
}
