import { type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ApiError } from "@/lib/http/api-error";
import { tasksClient } from "./task-client";
import type { TaskCard, TaskOutput, TaskStatus } from "./task-contracts";
import { taskKeys } from "./task-keys";
import { canTransitionTask } from "./task-transitions";

interface TransitionVariables {
  companyId: string;
  taskId: string;
  fromStatus: TaskStatus;
  status: TaskStatus;
  operationId: string;
}

interface RollbackEntry {
  queryKey: QueryKey;
  task: TaskCard;
  index: number;
  optimisticData: TaskCard[];
}

type OptimisticTaskCard = TaskCard & { __transitionOperationId?: string };

interface TransitionContext {
  operationId: string;
  entries: RollbackEntry[];
}

export function useTaskTransition() {
  const queryClient = useQueryClient();
  const activeOperations = useRef(new Map<string, string>());
  const [pendingTaskIds, setPendingTaskIds] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation<TaskOutput, Error, TransitionVariables, TransitionContext>({
    mutationKey: ["tasks", "transition"],
    mutationFn: ({ companyId, taskId, status }) =>
      tasksClient.transition(companyId, taskId, status),
    onMutate: async (variables) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: taskKeys.lists(variables.companyId) }),
        queryClient.cancelQueries({
          queryKey: taskKeys.detail(variables.companyId, variables.taskId),
        }),
      ]);
      const entries: RollbackEntry[] = [];
      for (const [queryKey, data] of queryClient.getQueriesData<TaskCard[]>({
        queryKey: taskKeys.lists(variables.companyId),
      })) {
        if (!data) continue;
        const index = data.findIndex((task) => task.id === variables.taskId);
        if (index < 0) continue;
        const previous = data[index];
        if (!previous) continue;
        const statusFilter = getStatusFilter(queryKey);
        const optimisticInput =
          statusFilter && statusFilter !== variables.status
            ? data.filter((task) => task.id !== variables.taskId)
            : data.map((task) =>
                task.id === variables.taskId
                  ? {
                      ...task,
                      status: variables.status,
                      __transitionOperationId: variables.operationId,
                    }
                  : task,
              );
        queryClient.setQueryData(queryKey, optimisticInput);
        const optimisticData =
          queryClient.getQueryData<TaskCard[]>(queryKey) ?? (optimisticInput as TaskCard[]);
        entries.push({ queryKey, task: previous, index, optimisticData });
      }
      return { operationId: variables.operationId, entries };
    },
    onSuccess: (output, variables, context) => {
      if (activeOperations.current.get(variables.taskId) !== variables.operationId) return;
      for (const entry of context.entries) {
        const current = queryClient.getQueryData<TaskCard[]>(entry.queryKey);
        const optimisticTask = current?.find((task) => task.id === variables.taskId) as
          | OptimisticTaskCard
          | undefined;
        if (optimisticTask?.__transitionOperationId !== variables.operationId) continue;
        queryClient.setQueryData<TaskCard[]>(entry.queryKey, (data) =>
          data?.map((task) =>
            task.id === variables.taskId
              ? withoutOperationMarker({
                  ...task,
                  ...output,
                  assignee: task.assignee,
                  requisition: task.requisition,
                })
              : task,
          ),
        );
      }
    },
    onError: (cause, variables, context) => {
      if (activeOperations.current.get(variables.taskId) !== variables.operationId) return;
      for (const entry of context?.entries ?? []) {
        const currentData = queryClient.getQueryData<TaskCard[]>(entry.queryKey);
        const optimisticTask = currentData?.find((task) => task.id === variables.taskId) as
          | OptimisticTaskCard
          | undefined;
        const removedByThisOperation =
          currentData === entry.optimisticData && optimisticTask === undefined;
        if (
          optimisticTask?.__transitionOperationId !== variables.operationId &&
          !removedByThisOperation
        ) {
          continue;
        }
        queryClient.setQueryData<TaskCard[]>(entry.queryKey, (current) => {
          if (!current) return current;
          const currentIndex = current.findIndex((task) => task.id === variables.taskId);
          if (currentIndex >= 0) {
            return current.map((task) => (task.id === variables.taskId ? entry.task : task));
          }
          const restored = [...current];
          restored.splice(Math.min(entry.index, restored.length), 0, entry.task);
          return restored;
        });
      }
      setError(messageForTransitionError(cause));
    },
    onSettled: (_data, _cause, variables) => {
      if (activeOperations.current.get(variables.taskId) === variables.operationId) {
        activeOperations.current.delete(variables.taskId);
        setPendingTaskIds((current) => {
          const next = new Set(current);
          next.delete(variables.taskId);
          return next;
        });
      }
      void queryClient.invalidateQueries({ queryKey: taskKeys.lists(variables.companyId) });
      void queryClient.invalidateQueries({
        queryKey: taskKeys.detail(variables.companyId, variables.taskId),
      });
    },
  });

  function transition(input: Omit<TransitionVariables, "operationId">): boolean {
    if (!canTransitionTask(input.fromStatus, input.status)) return false;
    if (activeOperations.current.has(input.taskId)) return false;
    const operationId = crypto.randomUUID();
    activeOperations.current.set(input.taskId, operationId);
    setPendingTaskIds((current) => new Set(current).add(input.taskId));
    setError(null);
    mutation.mutate({ ...input, operationId });
    return true;
  }

  return { transition, pendingTaskIds, error, clearError: () => setError(null) };
}

function withoutOperationMarker(task: OptimisticTaskCard): TaskCard {
  const { __transitionOperationId: _operationId, ...cleanTask } = task;
  return cleanTask;
}

function getStatusFilter(queryKey: QueryKey): TaskStatus | undefined {
  const filters = queryKey[3];
  if (!filters || typeof filters !== "object" || !("status" in filters)) return undefined;
  return (filters as { status?: TaskStatus }).status;
}

export function messageForTransitionError(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return "Você não tem permissão para mover esta tarefa.";
    if (error.status === 404) return "A tarefa não foi encontrada. O board será atualizado.";
    if (error.status === 409) return "A tarefa foi alterada por outra operação. Tente novamente.";
    if (error.status === 422) return error.message;
    if (error.status >= 500) return "Não foi possível mover a tarefa. Tente novamente.";
  }
  return "Não foi possível mover a tarefa. Verifique sua conexão e tente novamente.";
}
