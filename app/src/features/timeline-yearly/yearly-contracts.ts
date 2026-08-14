import {
  REQUISITION_PRIORITIES,
  type RequisitionPriority,
  type RequisitionStatus,
} from "@/features/requisitions/requisition-contracts";

export interface YearlyItem {
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

export interface YearlyMonth {
  period: string;
  requisitionCount: number;
  countsByPriority: Record<RequisitionPriority, number>;
  estimatedHours: number;
  deliveredOnTime: number;
  overdue: number;
  items: YearlyItem[];
  undatedItems: YearlyItem[];
}

export interface YearlyTimeline {
  companyId: string;
  year: string;
  months: YearlyMonth[];
  indicators: {
    totalRequisitions: number;
    estimatedHours: number;
    deliveredOnTime: number;
    overdue: number;
  };
}

export interface YearlyFilters {
  priority?: RequisitionPriority;
  assigneeId?: string;
  status?: RequisitionStatus;
}

const YEAR = /^\d{4}$/;
const PERIOD = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export function isValidYear(value: unknown): value is string {
  return typeof value === "string" && YEAR.test(value);
}

export function parseYearlyTimeline(value: unknown): YearlyTimeline {
  if (
    !record(value) ||
    !only(value, ["companyId", "year", "months", "indicators"]) ||
    typeof value.companyId !== "string" ||
    !isValidYear(value.year) ||
    !Array.isArray(value.months) ||
    value.months.length !== 12 ||
    !indicators(value.indicators)
  )
    throw new Error("Contrato da timeline anual inválido");
  return {
    companyId: value.companyId,
    year: value.year,
    months: value.months.map(parseMonth),
    indicators: value.indicators,
  };
}

function parseMonth(value: unknown): YearlyMonth {
  if (
    !record(value) ||
    !only(value, [
      "period",
      "requisitionCount",
      "countsByPriority",
      "estimatedHours",
      "deliveredOnTime",
      "overdue",
      "items",
      "undatedItems",
    ]) ||
    typeof value.period !== "string" ||
    !PERIOD.test(value.period) ||
    !integer(value.requisitionCount) ||
    !priorityCounts(value.countsByPriority) ||
    !number(value.estimatedHours) ||
    !integer(value.deliveredOnTime) ||
    !integer(value.overdue) ||
    !Array.isArray(value.items) ||
    !Array.isArray(value.undatedItems)
  )
    throw new Error("Contrato da timeline anual inválido");
  return {
    period: value.period,
    requisitionCount: value.requisitionCount,
    countsByPriority: value.countsByPriority,
    estimatedHours: value.estimatedHours,
    deliveredOnTime: value.deliveredOnTime,
    overdue: value.overdue,
    items: value.items.map(parseItem),
    undatedItems: value.undatedItems.map(parseItem),
  };
}

function parseItem(value: unknown): YearlyItem {
  if (
    !record(value) ||
    !only(value, [
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
    ]) ||
    typeof value.requisitionId !== "string" ||
    !Number.isInteger(value.number) ||
    typeof value.title !== "string" ||
    !REQUISITION_PRIORITIES.includes(value.priority as RequisitionPriority) ||
    !(typeof value.assigneeId === "string" || value.assigneeId === null) ||
    !nullableDate(value.startDate) ||
    !nullableDate(value.plannedDeliveryDate) ||
    !nullableInstant(value.deliveredAt) ||
    !number(value.estimatedHours) ||
    value.estimatedHours < 0 ||
    typeof value.isOverdue !== "boolean" ||
    typeof value.deliveredOnTime !== "boolean"
  )
    throw new Error("Contrato da timeline anual inválido");
  return value as unknown as YearlyItem;
}

function indicators(value: unknown): value is YearlyTimeline["indicators"] {
  return (
    record(value) &&
    only(value, ["totalRequisitions", "estimatedHours", "deliveredOnTime", "overdue"]) &&
    [value.totalRequisitions, value.estimatedHours, value.deliveredOnTime, value.overdue].every(
      number,
    )
  );
}
function priorityCounts(value: unknown): value is Record<RequisitionPriority, number> {
  return (
    record(value) &&
    only(value, ["LOW", "MEDIUM", "HIGH"]) &&
    [value.LOW, value.MEDIUM, value.HIGH].every(integer)
  );
}
function number(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function integer(value: unknown): value is number {
  return number(value) && Number.isInteger(value) && value >= 0;
}
function nullableDate(value: unknown) {
  return value === null || (typeof value === "string" && DATE.test(value));
}
function nullableInstant(value: unknown) {
  return (
    value === null ||
    (typeof value === "string" && INSTANT.test(value) && !Number.isNaN(new Date(value).getTime()))
  );
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function only(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}
