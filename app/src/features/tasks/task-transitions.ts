import type { TaskStatus } from "./task-contracts";

export const TASK_STATUS_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  TODO: ["IN_PROGRESS"],
  IN_PROGRESS: ["PAUSED", "DONE"],
  PAUSED: ["IN_PROGRESS"],
  DONE: [],
};

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_STATUS_TRANSITIONS[from].includes(to);
}

export const QUICK_TASK_ACTIONS = {
  TODO: [{ label: "Iniciar", status: "IN_PROGRESS" }],
  IN_PROGRESS: [
    { label: "Pausar", status: "PAUSED" },
    { label: "Concluir", status: "DONE" },
  ],
  PAUSED: [{ label: "Retomar", status: "IN_PROGRESS" }],
  DONE: [],
} as const satisfies Readonly<Record<TaskStatus, readonly { label: string; status: TaskStatus }[]>>;
