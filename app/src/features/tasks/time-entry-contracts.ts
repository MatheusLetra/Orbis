export interface TimeEntryOutput {
  id: string;
  companyId: string;
  taskId: string;
  userId: string;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number;
  description: string | null;
  createdAt: string;
}

export interface TimeEntryListOutput {
  items: TimeEntryOutput[];
  totalDurationMinutes: number;
  hasMore: boolean;
}

export function parseTimeEntryListOutput(value: unknown): TimeEntryListOutput {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error("Contrato de apontamentos inválido");
  }

  const totalDurationMinutes = value.totalDurationMinutes;
  if (
    typeof totalDurationMinutes !== "number" ||
    !Number.isInteger(totalDurationMinutes) ||
    totalDurationMinutes < 0 ||
    typeof value.hasMore !== "boolean"
  ) {
    throw new Error("Contrato de apontamentos inválido");
  }

  return {
    items: value.items.map(parseTimeEntryOutput),
    totalDurationMinutes,
    hasMore: value.hasMore,
  };
}

function parseTimeEntryOutput(value: unknown): TimeEntryOutput {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.companyId !== "string" ||
    typeof value.taskId !== "string" ||
    typeof value.userId !== "string" ||
    !nullableString(value.startedAt) ||
    !nullableString(value.endedAt) ||
    !nullableString(value.description) ||
    typeof value.createdAt !== "string"
  ) {
    throw new Error("Contrato de apontamento inválido");
  }

  const durationMinutes = value.durationMinutes;
  if (
    typeof durationMinutes !== "number" ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 1 ||
    durationMinutes > 1440
  ) {
    throw new Error("Contrato de apontamento inválido");
  }

  return value as unknown as TimeEntryOutput;
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
