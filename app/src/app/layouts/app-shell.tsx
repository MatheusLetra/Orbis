import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/common/theme-toggle";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">Orbis</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>

      <footer className="border-t py-4">
        <p className="px-4 text-center text-xs text-muted-foreground sm:px-6">
          Orbis — gestão de requisições e tarefas
        </p>
      </footer>
    </div>
  );
}
