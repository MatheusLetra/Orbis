import { AppShell } from "@/app/layouts/app-shell";
import { AppProviders } from "@/app/providers/app-providers";

export default function App() {
  return (
    <AppProviders>
      <AppShell>
        <section className="mx-auto flex max-w-5xl flex-col items-center gap-4 py-16 text-center sm:py-24">
          <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">Bem-vindo ao Orbis</h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            Plataforma multiempresa para gestão de requisições, tarefas, capacidade da equipe,
            Kanban e timelines.
          </p>
        </section>
      </AppShell>
    </AppProviders>
  );
}
