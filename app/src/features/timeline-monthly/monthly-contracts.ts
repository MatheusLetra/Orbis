import {
  REQUISITION_PRIORITIES,
  type RequisitionPriority,
  type RequisitionStatus,
} from "@/features/requisitions/requisition-contracts";

export interface MonthlyItem {
  requisitionId: string;
  number: number;
  title: string;
  priority: RequisitionPriority;
  assigneeId: string | null;
  startDate: string | null;
  plannedDeliveryDate: string | null;
  deliveredAt: string | null;
  estimatedHours: number;
  isOverdue: boolean;
  deliveredOnTime: boolean;
}

export interface MonthlyIndicators {
  totalRequisitions: number;
  estimatedHours: number;
  deliveredOnTime: number;
  overdue: number;
}

export interface MonthlyTimeline {
  companyId: string;
  period: string;
  items: MonthlyItem[];
  undatedItems: MonthlyItem[];
  indicators: MonthlyIndicators;
}

export interface MonthlyFilters {
  priority?: RequisitionPriority;
  assigneeId?: string;
  status?: RequisitionStatus;
}

const PERIOD = /^(\d{4})-(\d{2})$/;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const ITEM_KEYS = [
  "requisitionId",
  "number",
  "title",
  "priority",
  "assigneeId",
  "startDate",
  "plannedDeliveryDate",
  "deliveredAt",
  "estimatedHours",
  "isOverdue",
  "deliveredOnTime",
] as const;
const INDICATOR_KEYS = [
  "totalRequisitions",
  "estimatedHours",
  "deliveredOnTime",
  "overdue",
] as const;

export function isValidMonthlyPeriod(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = PERIOD.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function parseMonthlyTimeline(value: unknown): MonthlyTimeline {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["companyId", "period", "items", "undatedItems", "indicators"]) ||
    typeof value.companyId !== "string" ||
    !isValidMonthlyPeriod(value.period) ||
    !Array.isArray(value.items) ||
    !Array.isArray(value.undatedItems) ||
    !isIndicators(value.indicators)
  ) {
    return invalid();
  }
  let items: MonthlyItem[];
  let undatedItems: MonthlyItem[];
  try {
    items = value.items.map(parseMonthlyItem);
    undatedItems = value.undatedItems.map(parseMonthlyItem);
  } catch {
    return invalid();
  }
  return {
    companyId: value.companyId,
    period: value.period,
    items,
    undatedItems,
    indicators: value.indicators,
  };
}

function parseMonthlyItem(value: unknown): MonthlyItem {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ITEM_KEYS) ||
    typeof value.requisitionId !== "string" ||
    !Number.isInteger(value.number) ||
    typeof value.title !== "string" ||
    !REQUISITION_PRIORITIES.includes(value.priority as RequisitionPriority) ||
    !(typeof value.assigneeId === "string" || value.assigneeId === null) ||
    !isNullableDate(value.startDate) ||
    !isNullableDate(value.plannedDeliveryDate) ||
    !isNullableInstant(value.deliveredAt) ||
    !isFiniteNumber(value.estimatedHours) ||
    value.estimatedHours < 0 ||
    typeof value.isOverdue !== "boolean" ||
    typeof value.deliveredOnTime !== "boolean"
  ) {
    return invalid();
  }
  return value as unknown as MonthlyItem;
}

function isIndicators(value: unknown): value is MonthlyIndicators {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, INDICATOR_KEYS) &&
    INDICATOR_KEYS.every((key) => isFiniteNumber(value[key]))
  );
}

function isNullableDate(value: unknown): value is string | null {
  return value === null || isCalendarDate(value);
}

function isNullableInstant(value: unknown): value is string | null {
  if (value === null) return true;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
  ) {
    return false;
  }
  const date = new Date(value);
  const expected = value.slice(0, 10).split("-").map(Number);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === expected[0] &&
    date.getUTCMonth() + 1 === expected[1] &&
    date.getUTCDate() === expected[2]
  );
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const expected = new Set(keys);
  return (
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => expected.has(key))
  );
}

function invalid(): never {
  throw new Error("Contrato da timeline mensal inválido");
}
