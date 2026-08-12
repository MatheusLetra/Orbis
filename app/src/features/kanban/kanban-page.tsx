import { AppShell } from "@/app/layouts/app-shell";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { useActiveCompany } from "@/features/companies/active-company-provider";
import { useTaskTransition } from "@/features/tasks/task-mutations";
import { useTasks } from "@/features/tasks/task-queries";
import { KanbanBoard } from "./kanban-board";

export function KanbanPage() {
  const company = useActiveCompany();
  const activeCompany = company.activeCompany;
  const tasksQuery = useTasks(activeCompany?.id ?? null);
  const transition = useTaskTransition();

  if (company.status !== "ready" || !activeCompany) {
    return (
      <AppShell>
        <section className="mx-auto max-w-5xl py-12">
          <h1 className="sr-only">Board de tarefas</h1>
          {company.status === "error" ? (
            <ErrorState message="Não foi possível carregar suas empresas." />
          ) : company.status === "ready" && company.companies.length === 0 ? (
            <EmptyState
              title="Nenhuma empresa disponível"
              description="Sua conta ainda não possui uma empresa autorizada."
            />
          ) : (
            <LoadingState label="Carregando empresa ativa..." />
          )}
        </section>
      </AppShell>
    );
  }

  if (tasksQuery.isPending) {
    return (
      <AppShell>
        <BoardHeader companyName={activeCompany.name} />
        <LoadingState label="Carregando tarefas..." />
      </AppShell>
    );
  }

  if (tasksQuery.isError) {
    return (
      <AppShell>
        <BoardHeader companyName={activeCompany.name} />
        <ErrorState
          message="Não foi possível carregar as tarefas."
          onRetry={() => void tasksQuery.refetch()}
        />
      </AppShell>
    );
  }

  if (tasksQuery.data.length === 0) {
    return (
      <AppShell>
        <BoardHeader companyName={activeCompany.name} />
        <EmptyState
          title="Nenhuma tarefa ainda"
          description="As tarefas desta empresa aparecerão aqui quando forem criadas."
        />
      </AppShell>
    );
  }

  try {
    return (
      <AppShell>
        <BoardHeader companyName={activeCompany.name} />
        {transition.error && (
          <div className="mb-4" role="alert">
            <ErrorState message={transition.error} />
          </div>
        )}
        <KanbanBoard
          tasks={tasksQuery.data}
          pendingTaskIds={transition.pendingTaskIds}
          onTransition={(task, status) =>
            transition.transition({
              companyId: activeCompany.id,
              taskId: task.id,
              fromStatus: task.status,
              status,
            })
          }
        />
      </AppShell>
    );
  } catch {
    return (
      <AppShell>
        <BoardHeader companyName={activeCompany.name} />
        <ErrorState message="A lista de tarefas retornou um status desconhecido." />
      </AppShell>
    );
  }
}

function BoardHeader({ companyName }: { companyName: string }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-sm text-muted-foreground">Tarefas · {companyName}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Board de tarefas</h1>
      </div>
      <p className="text-sm text-muted-foreground">Visão por status</p>
    </header>
  );
}
