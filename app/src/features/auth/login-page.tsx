import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/http/api-error";

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    try {
      await auth.login(String(data.get("email")), String(data.get("password")));
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(from && from !== "/login" ? from : "/", { replace: true });
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 401
          ? "E-mail ou senha inválidos."
          : "Não foi possível entrar. Verifique sua conexão e tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-dvh bg-muted/30 lg:grid-cols-[minmax(0,1fr)_30rem]">
      <section className="hidden border-r bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <span className="text-xl font-semibold tracking-tight">Orbis</span>
        <div className="max-w-xl space-y-4">
          <p className="text-sm uppercase tracking-[0.24em] opacity-70">Operação conectada</p>
          <h1 className="text-4xl font-semibold leading-tight">
            Trabalho, contexto e decisões no mesmo lugar.
          </h1>
        </div>
      </section>
      <main className="flex min-h-dvh flex-col p-6 sm:p-10">
        <div className="flex items-center justify-between lg:justify-end">
          <span className="text-lg font-semibold lg:hidden">Orbis</span>
          <ThemeToggle />
        </div>
        <div className="my-auto mx-auto w-full max-w-sm py-12">
          <div className="mb-8 space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">Acesse sua conta</h2>
            <p className="text-sm text-muted-foreground">Use suas credenciais do Orbis.</p>
          </div>
          <form className="space-y-5" onSubmit={submit}>
            <label className="grid gap-2 text-sm font-medium">
              E-mail
              <input
                className="h-10 rounded-md border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                type="email"
                name="email"
                autoComplete="email"
                required
                disabled={loading}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Senha
              <input
                className="h-10 rounded-md border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                type="password"
                name="password"
                autoComplete="current-password"
                required
                disabled={loading}
              />
            </label>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
