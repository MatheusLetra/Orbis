export interface CapacitySimulationInput {
  startDate: string;
  estimatedHours: number;
}

export interface CapacitySimulationOutput extends CapacitySimulationInput {
  companyId: string;
  availableDevelopers: number;
  dailyHoursPerDeveloper: number;
  dailyCapacity: number;
  requiredDays: number;
  plannedDeliveryDate: string;
}

export function isValidCapacitySimulationInput(value: unknown): value is CapacitySimulationInput {
  return Boolean(
    isRecord(value) &&
      isIsoDateTime(value.startDate) &&
      isFiniteNumber(value.estimatedHours) &&
      value.estimatedHours >= 0,
  );
}

export function parseCapacitySimulationOutput(value: unknown): CapacitySimulationOutput {
  if (!isRecord(value)) throw new Error("Contrato de capacidade inválido");

  const input = {
    startDate: value.startDate,
    estimatedHours: value.estimatedHours,
  };

  const keys = Object.keys(value).sort();
  const expected = [
    "availableDevelopers",
    "companyId",
    "dailyCapacity",
    "dailyHoursPerDeveloper",
    "estimatedHours",
    "plannedDeliveryDate",
    "requiredDays",
    "startDate",
  ].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new Error("Contrato de capacidade inválido");
  }

  if (
    typeof value.companyId !== "string" ||
    !isUuid(value.companyId) ||
    !isValidCapacitySimulationInput(input) ||
    !isFiniteInteger(value.availableDevelopers) ||
    value.availableDevelopers < 0 ||
    !isFiniteNumber(value.dailyHoursPerDeveloper) ||
    value.dailyHoursPerDeveloper <= 0 ||
    value.dailyHoursPerDeveloper > 24 ||
    !isFiniteNumber(value.dailyCapacity) ||
    value.dailyCapacity <= 0 ||
    !isFiniteNumber(value.requiredDays) ||
    value.requiredDays < 0 ||
    !isIsoDateTime(value.plannedDeliveryDate)
  ) {
    throw new Error("Contrato de capacidade inválido");
  }

  return { ...value, ...input } as CapacitySimulationOutput;
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function isIsoDateTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})$/.test(value) &&
    !Number.isNaN(new Date(value).getTime())
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isFiniteInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
