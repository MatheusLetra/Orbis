import { Entity } from "@/shared/domain/entity";
import { BusinessRuleError } from "@/shared/errors/typed-errors";

export interface TaskPauseIntervalProps {
  id: string;
  taskId: string;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number | null;
}

export class TaskPauseInterval extends Entity<string> {
  private constructor(private readonly props: TaskPauseIntervalProps) {
    super(props.id);
  }

  static createOpen(
    data: { taskId: string; startedAt?: Date },
    id = crypto.randomUUID(),
  ): TaskPauseInterval {
    return new TaskPauseInterval({
      id,
      taskId: data.taskId,
      startedAt: data.startedAt ?? new Date(),
      endedAt: null,
      durationSeconds: null,
    });
  }

  static restore(props: TaskPauseIntervalProps): TaskPauseInterval {
    if ((props.endedAt === null) !== (props.durationSeconds === null)) {
      throw new BusinessRuleError("Intervalo de pausa possui fechamento inconsistente");
    }
    if (props.durationSeconds !== null && !Number.isInteger(props.durationSeconds)) {
      throw new BusinessRuleError("Duração da pausa deve usar segundos inteiros");
    }
    if (props.durationSeconds !== null && props.durationSeconds < 0) {
      throw new BusinessRuleError("Duração da pausa não pode ser negativa");
    }
    if (props.endedAt !== null && props.endedAt < props.startedAt) {
      throw new BusinessRuleError("Fim da pausa não pode ser anterior ao início");
    }

    return new TaskPauseInterval(props);
  }

  get taskId(): string {
    return this.props.taskId;
  }

  get startedAt(): Date {
    return this.props.startedAt;
  }

  get endedAt(): Date | null {
    return this.props.endedAt;
  }

  get durationSeconds(): number | null {
    return this.props.durationSeconds;
  }

  close(endedAt: Date): void {
    if (this.props.endedAt !== null) {
      throw new BusinessRuleError("Intervalo de pausa já foi fechado");
    }
    if (endedAt < this.props.startedAt) {
      throw new BusinessRuleError("Fim da pausa não pode ser anterior ao início");
    }

    const durationSeconds = Math.floor((endedAt.getTime() - this.props.startedAt.getTime()) / 1000);
    if (durationSeconds < 0) {
      throw new BusinessRuleError("Duração da pausa não pode ser negativa");
    }

    this.props.endedAt = endedAt;
    this.props.durationSeconds = durationSeconds;
  }
}
