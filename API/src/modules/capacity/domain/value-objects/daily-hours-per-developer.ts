import { BusinessRuleError } from "@/shared/errors/typed-errors";

export const MIN_DAILY_HOURS_PER_DEVELOPER = 0.01;
export const MAX_DAILY_HOURS_PER_DEVELOPER = 24;

export function assertDailyHoursPerDeveloper(value: number): number {
  const hasAtMostTwoDecimalPlaces = Math.round(value * 100) / 100 === value;

  if (
    !Number.isFinite(value) ||
    value < MIN_DAILY_HOURS_PER_DEVELOPER ||
    value > MAX_DAILY_HOURS_PER_DEVELOPER ||
    !hasAtMostTwoDecimalPlaces
  ) {
    throw new BusinessRuleError("Horas diárias por desenvolvedor inválidas");
  }

  return value;
}
