import { useEffect, useState } from "react";
import { AppShell } from "@/app/layouts/app-shell";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { useAuth } from "@/features/auth/auth-provider";
import { useActiveCompany } from "@/features/companies/active-company-provider";
import { useCompanyCapabilities } from "@/features/companies/capabilities-queries";
import { canEditTask } from "@/features/tasks/task-authorization";
import type { TaskCard } from "@/features/tasks/task-contracts";
import { useTaskTransition } from "@/features/tasks/task-mutations";
import { useTasks } from "@/features/tasks/task-queries";
import { KanbanBoard } from "./kanban-board";
import { QuickTaskDialog } from "./quick-task-dialog";
import { TaskDetailDialog } from "./task-detail-dialog";

export function KanbanPage() {
  const company = useActiveCompany();
  const auth = useAuth();
  const activeCompany = company.activeCompany;
  const tasksQuery = useTasks(activeCompany?.id ?? null);
  const capabilitiesQuery = useCompanyCapabilities(activeCompany?.id ?? null);
  const transition = useTaskTransition();
  const [selectedTask, setSelectedTask] = useState<TaskCard | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetar seleção ao trocar de empresa
  useEffect(() => {
    setSelectedTask(null);
  }, [activeCompany?.id]);

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
        <BoardHeader
          companyName={activeCompany.name}
          companyId={activeCompany.id}
          canCreate={
            capabilitiesQuery.isSuccess &&
            capabilitiesQuery.data.capabilities["tasks.create"] === true
          }
        />
        <LoadingState label="Carregando tarefas..." />
      </AppShell>
    );
  }

  if (tasksQuery.isError) {
    return (
      <AppShell>
        <BoardHeader
          companyName={activeCompany.name}
          companyId={activeCompany.id}
          canCreate={
            capabilitiesQuery.isSuccess &&
            capabilitiesQuery.data.capabilities["tasks.create"] === true
          }
        />
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
        <BoardHeader
          companyName={activeCompany.name}
          companyId={activeCompany.id}
          canCreate={
            capabilitiesQuery.isSuccess &&
            capabilitiesQuery.data.capabilities["tasks.create"] === true
          }
        />
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
        <BoardHeader
          companyName={activeCompany.name}
          companyId={activeCompany.id}
          canCreate={
            capabilitiesQuery.isSuccess &&
            capabilitiesQuery.data.capabilities["tasks.create"] === true
          }
        />
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
          onViewDetails={(task) => setSelectedTask(task)}
          companyId={activeCompany.id}
          canEdit={(task) => canEditTask(task, capabilitiesQuery.data, auth.user?.id)}
        />
        {selectedTask && (
          <TaskDetailDialog
            companyId={activeCompany.id}
            task={selectedTask}
            isOpen
            onClose={() => setSelectedTask(null)}
          />
        )}
      </AppShell>
    );
  } catch {
    return (
      <AppShell>
        <BoardHeader
          companyName={activeCompany.name}
          companyId={activeCompany.id}
          canCreate={
            capabilitiesQuery.isSuccess &&
            capabilitiesQuery.data.capabilities["tasks.create"] === true
          }
        />
        <ErrorState message="A lista de tarefas retornou um status desconhecido." />
      </AppShell>
    );
  }
}

function BoardHeader({
  companyName,
  companyId,
  canCreate = false,
}: {
  companyName: string;
  companyId: string;
  canCreate?: boolean;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-sm text-muted-foreground">Tarefas · {companyName}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Board de tarefas</h1>
      </div>
      <div className="flex items-center gap-3">
        <QuickTaskDialog companyId={companyId} canCreate={canCreate} />
        <p className="text-sm text-muted-foreground">Visão por status</p>
      </div>
    </header>
  );
}
