import { isValidTaskTransition, type TaskStatus } from "@/modules/tasks/domain/entities/task";
import { Entity } from "@/shared/domain/entity";
import { BusinessRuleError } from "@/shared/errors/typed-errors";

export interface TaskStatusHistoryProps {
  id: string;
  taskId: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  changedBy: string;
  changedAt: Date;
  metadata: Record<string, unknown> | null;
}

export interface CreateInitialTaskStatusHistoryData {
  taskId: string;
  changedBy: string;
  changedAt?: Date;
  metadata?: Record<string, unknown> | null;
}

export interface CreateTaskStatusHistoryTransitionData {
  taskId: string;
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  changedBy: string;
  changedAt?: Date;
  metadata?: Record<string, unknown> | null;
}

export class TaskStatusHistory extends Entity<string> {
  private constructor(private readonly props: TaskStatusHistoryProps) {
    super(props.id);
  }

  static createInitial(
    data: CreateInitialTaskStatusHistoryData,
    id = crypto.randomUUID(),
  ): TaskStatusHistory {
    return new TaskStatusHistory({
      id,
      taskId: data.taskId,
      fromStatus: null,
      toStatus: "TODO",
      changedBy: data.changedBy,
      changedAt: data.changedAt ?? new Date(),
      metadata: data.metadata ?? null,
    });
  }

  static createTransition(
    data: CreateTaskStatusHistoryTransitionData,
    id = crypto.randomUUID(),
  ): TaskStatusHistory {
    if (!isValidTaskTransition(data.fromStatus, data.toStatus)) {
      throw new BusinessRuleError(
        `Transição de status inválida: ${data.fromStatus} → ${data.toStatus}`,
      );
    }

    return new TaskStatusHistory({
      id,
      taskId: data.taskId,
      fromStatus: data.fromStatus,
      toStatus: data.toStatus,
      changedBy: data.changedBy,
      changedAt: data.changedAt ?? new Date(),
      metadata: data.metadata ?? null,
    });
  }

  get taskId(): string {
    return this.props.taskId;
  }

  get fromStatus(): TaskStatus | null {
    return this.props.fromStatus;
  }

  get toStatus(): TaskStatus {
    return this.props.toStatus;
  }

  get changedBy(): string {
    return this.props.changedBy;
  }

  get changedAt(): Date {
    return this.props.changedAt;
  }

  get metadata(): Record<string, unknown> | null {
    return this.props.metadata;
  }
}
