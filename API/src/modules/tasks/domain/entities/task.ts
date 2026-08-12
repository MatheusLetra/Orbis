import { Entity } from "@/shared/domain/entity";
import { BusinessRuleError } from "@/shared/errors/typed-errors";

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "PAUSED", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface TaskProps {
  id: string;
  companyId: string;
  requisitionId: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  assigneeId: string | null;
  startDate: Date | null;
  plannedEndDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskData {
  companyId: string;
  title: string;
  requisitionId?: string;
  description?: string;
  priority?: TaskPriority;
  assigneeId?: string;
  startDate?: Date;
  plannedEndDate?: Date;
}

const VALID_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  TODO: ["IN_PROGRESS"],
  IN_PROGRESS: ["PAUSED", "DONE"],
  PAUSED: ["IN_PROGRESS"],
  DONE: [],
};

export function isValidTaskTransition(fromStatus: TaskStatus, toStatus: TaskStatus): boolean {
  return VALID_TRANSITIONS[fromStatus].includes(toStatus);
}

export class Task extends Entity<string> {
  private constructor(private readonly props: TaskProps) {
    super(props.id);
  }

  static create(data: CreateTaskData, id = crypto.randomUUID()): Task {
    const title = normalizeTitle(data.title);
    const now = new Date();

    return new Task({
      id,
      companyId: data.companyId,
      requisitionId: data.requisitionId ?? null,
      title,
      description: data.description?.trim() || null,
      priority: data.priority ?? "MEDIUM",
      status: "TODO",
      assigneeId: data.assigneeId ?? null,
      startDate: data.startDate ?? null,
      plannedEndDate: data.plannedEndDate ?? null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: TaskProps): Task {
    normalizeTitle(props.title);

    if (props.status === "DONE" && props.completedAt === null) {
      throw new BusinessRuleError("Task concluída deve possuir completedAt");
    }
    if (props.status !== "DONE" && props.completedAt !== null) {
      throw new BusinessRuleError("Task não concluída não pode possuir completedAt");
    }

    return new Task(props);
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get requisitionId(): string | null {
    return this.props.requisitionId;
  }

  get title(): string {
    return this.props.title;
  }

  get description(): string | null {
    return this.props.description;
  }

  get priority(): TaskPriority {
    return this.props.priority;
  }

  get status(): TaskStatus {
    return this.props.status;
  }

  get assigneeId(): string | null {
    return this.props.assigneeId;
  }

  get startDate(): Date | null {
    return this.props.startDate;
  }

  get plannedEndDate(): Date | null {
    return this.props.plannedEndDate;
  }

  get completedAt(): Date | null {
    return this.props.completedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  rename(title: string): void {
    this.assertMutable();
    this.props.title = normalizeTitle(title);
    this.touch();
  }

  changeDescription(description: string | null): void {
    this.assertMutable();
    this.props.description = description?.trim() || null;
    this.touch();
  }

  changePriority(priority: TaskPriority): void {
    this.assertMutable();
    this.props.priority = priority;
    this.touch();
  }

  changeAssignee(assigneeId: string | null): void {
    this.assertMutable();
    this.props.assigneeId = assigneeId;
    this.touch();
  }

  changeRequisition(requisitionId: string | null): void {
    this.assertMutable();
    this.props.requisitionId = requisitionId;
    this.touch();
  }

  changeStartDate(startDate: Date | null): void {
    this.assertMutable();
    this.props.startDate = startDate;
    this.touch();
  }

  changePlannedEndDate(plannedEndDate: Date | null): void {
    this.assertMutable();
    this.props.plannedEndDate = plannedEndDate;
    this.touch();
  }

  transitionTo(newStatus: TaskStatus, occurredAt = new Date()): void {
    if (!isValidTaskTransition(this.props.status, newStatus)) {
      throw new BusinessRuleError(
        `Transição de status inválida: ${this.props.status} → ${newStatus}`,
      );
    }

    this.props.status = newStatus;
    this.props.completedAt = newStatus === "DONE" ? occurredAt : null;
    this.props.updatedAt = occurredAt;
  }

  private assertMutable(): void {
    if (this.props.status === "DONE") {
      throw new BusinessRuleError("Task concluída não pode ser alterada");
    }
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}

function normalizeTitle(title: string): string {
  const normalized = title.trim();
  if (!normalized) {
    throw new BusinessRuleError("Título da tarefa é obrigatório");
  }

  return normalized;
}
