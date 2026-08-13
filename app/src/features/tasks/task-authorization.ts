import type { CompanyCapabilities } from "@/features/companies/capabilities-contracts";
import type { TaskCard } from "./task-contracts";

export type TaskEditIntent = "edit" | "claim";

export function canEditTask(
  task: Pick<TaskCard, "status" | "assigneeId">,
  capabilities: CompanyCapabilities | null | undefined,
  actorUserId: string | null | undefined,
  intent: TaskEditIntent = "edit",
): boolean {
  if (task.status === "DONE" || !capabilities?.capabilities["tasks.update"]) return false;
  if (capabilities.capabilities["kanban.manage"]) return true;
  if (intent === "claim") return task.assigneeId === null && Boolean(actorUserId);
  return Boolean(actorUserId) && task.assigneeId === actorUserId;
}
