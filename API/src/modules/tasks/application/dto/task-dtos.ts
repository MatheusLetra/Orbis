import { z } from "zod";

import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Task,
  type TaskPriority,
} from "@/modules/tasks/domain/entities/task";
import type { TaskStatusHistory } from "@/modules/tasks/domain/entities/task-status-history";
import type { TaskListItem } from "@/modules/tasks/domain/repositories/task-repository";

export const createTaskSchema = z
  .object({
    requisitionId: z.string().uuid("requisitionId inválido").optional(),
    title: z.string().trim().min(1, "Título da tarefa é obrigatório"),
    description: z.string().trim().optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    assigneeId: z.string().uuid("assigneeId inválido").optional(),
    startDate: z.date().optional(),
    plannedEndDate: z.date().optional(),
  })
  .refine(
    (data) =>
      data.startDate === undefined ||
      data.plannedEndDate === undefined ||
      data.startDate.getTime() <= data.plannedEndDate.getTime(),
    { message: "Data de início não pode ser posterior à previsão de término" },
  )
  .strict();

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1, "Título da tarefa é obrigatório").optional(),
    description: z.string().trim().nullable().optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    assigneeId: z.string().uuid("assigneeId inválido").nullable().optional(),
    requisitionId: z.string().uuid("requisitionId inválido").nullable().optional(),
    startDate: z.date().nullable().optional(),
    plannedEndDate: z.date().nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nenhum campo para atualizar",
  });

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const listTasksSchema = z
  .object({
    scope: z.enum(["company", "own"]).default("company"),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    assigneeId: z.string().uuid("assigneeId inválido").optional(),
    requisitionId: z.string().uuid("requisitionId inválido").optional(),
    search: z
      .string()
      .trim()
      .max(200, "Pesquisa não pode exceder 200 caracteres")
      .transform((value) => value || undefined)
      .optional(),
  })
  .strict();

export type ListTasksInput = z.infer<typeof listTasksSchema>;

export interface TaskCardOutput extends TaskOutput {
  assignee: {
    id: string;
    name: string;
  } | null;
  requisition: {
    id: string;
    number: number;
    title: string;
  } | null;
}

export interface TaskOutput {
  id: string;
  companyId: string;
  requisitionId: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: string;
  assigneeId: string | null;
  startDate: string | null;
  plannedEndDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskStatusHistoryOutput {
  id: string;
  taskId: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string;
  changedAt: string;
  metadata: Record<string, unknown> | null;
}

export interface TaskDetailOutput extends TaskOutput {
  history: TaskStatusHistoryOutput[];
}

export function toTaskOutput(task: Task): TaskOutput {
  return {
    id: task.id,
    companyId: task.companyId,
    requisitionId: task.requisitionId,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    assigneeId: task.assigneeId,
    startDate: task.startDate?.toISOString() ?? null,
    plannedEndDate: task.plannedEndDate?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export function toTaskCardOutput(item: TaskListItem): TaskCardOutput {
  return {
    ...toTaskOutput(item.task),
    assignee: item.assignee,
    requisition: item.requisition,
  };
}

export function toTaskStatusHistoryOutput(history: TaskStatusHistory): TaskStatusHistoryOutput {
  return {
    id: history.id,
    taskId: history.taskId,
    fromStatus: history.fromStatus,
    toStatus: history.toStatus,
    changedBy: history.changedBy,
    changedAt: history.changedAt.toISOString(),
    metadata: history.metadata,
  };
}

export function toTaskDetailOutput(
  task: Task,
  history: TaskStatusHistoryOutput[],
): TaskDetailOutput {
  return {
    ...toTaskOutput(task),
    history,
  };
}
