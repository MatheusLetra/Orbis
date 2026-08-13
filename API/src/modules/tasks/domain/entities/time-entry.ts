import { Entity } from "@/shared/domain/entity";
import { BusinessRuleError } from "@/shared/errors/typed-errors";

export const TIME_ENTRY_MAX_DURATION_MINUTES = 1440;
const DESCRIPTION_MAX_LENGTH = 1000;

export interface TimeEntryProps {
  id: string;
  companyId: string;
  taskId: string;
  userId: string;
  startedAt: Date | null;
  endedAt: Date | null;
  durationMinutes: number;
  description: string | null;
  createdAt: Date;
}

export interface CreateTimeEntryData {
  companyId: string;
  taskId: string;
  userId: string;
  durationMinutes: number;
  description?: string;
  createdAt?: Date;
}

export class TimeEntry extends Entity<string> {
  private constructor(private readonly props: TimeEntryProps) {
    super(props.id);
  }

  static create(data: CreateTimeEntryData, id = crypto.randomUUID()): TimeEntry {
    const durationMinutes = validateDuration(data.durationMinutes);
    const description = normalizeDescription(data.description);
    const createdAt = data.createdAt ?? new Date();

    return new TimeEntry({
      id,
      companyId: data.companyId,
      taskId: data.taskId,
      userId: data.userId,
      startedAt: null,
      endedAt: null,
      durationMinutes,
      description,
      createdAt,
    });
  }

  static restore(props: TimeEntryProps): TimeEntry {
    validateDuration(props.durationMinutes);
    if (props.startedAt !== null || props.endedAt !== null) {
      throw new BusinessRuleError("Apontamento manual não possui intervalo");
    }
    if (props.description !== null && props.description.length > DESCRIPTION_MAX_LENGTH) {
      throw new BusinessRuleError("Descrição do apontamento excede o limite");
    }

    return new TimeEntry(props);
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get taskId(): string {
    return this.props.taskId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get startedAt(): Date | null {
    return this.props.startedAt;
  }

  get endedAt(): Date | null {
    return this.props.endedAt;
  }

  get durationMinutes(): number {
    return this.props.durationMinutes;
  }

  get description(): string | null {
    return this.props.description;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}

function validateDuration(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > TIME_ENTRY_MAX_DURATION_MINUTES) {
    throw new BusinessRuleError(
      "Duração do apontamento deve ser um inteiro entre 1 e 1440 minutos",
    );
  }
  return value;
}

function normalizeDescription(value: string | undefined): string | null {
  const normalized = value?.trim() ?? "";
  if (normalized.length > DESCRIPTION_MAX_LENGTH) {
    throw new BusinessRuleError("Descrição do apontamento excede o limite de 1000 caracteres");
  }
  return normalized || null;
}
