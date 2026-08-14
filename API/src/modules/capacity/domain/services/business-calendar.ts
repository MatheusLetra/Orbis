import { BusinessRuleError } from "@/shared/errors/typed-errors";

export type HolidayDates = readonly Date[];

/** Calendar rules that do not depend on persistence or an external clock. */
export class BusinessCalendar {
  isBusinessDay(date: Date, holidays: HolidayDates = []): boolean {
    validateDate(date, "date");
    const holidayKeys = createHolidayKeys(holidays);
    const dayOfWeek = date.getUTCDay();

    return dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayKeys.has(toDateKey(date));
  }

  addBusinessDays(date: Date, businessDays: number, holidays: HolidayDates = []): Date {
    validateDate(date, "date");
    validateBusinessDays(businessDays);
    const holidayKeys = createHolidayKeys(holidays);
    const result = new Date(date.getTime());
    let remainingDays = businessDays;

    while (remainingDays > 0) {
      result.setUTCDate(result.getUTCDate() + 1);
      const dayOfWeek = result.getUTCDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (!isWeekend && !holidayKeys.has(toDateKey(result))) remainingDays -= 1;
    }

    return result;
  }
}

function validateDate(value: Date, field: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new BusinessRuleError(`${field} inválida`);
  }
}

function validateBusinessDays(value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new BusinessRuleError("Quantidade de dias úteis inválida");
  }
}

function createHolidayKeys(holidays: HolidayDates): Set<string> {
  if (!Array.isArray(holidays)) throw new BusinessRuleError("Coleção de feriados inválida");

  return new Set(
    holidays.map((holiday) => {
      validateDate(holiday, "Feriado");
      return toDateKey(holiday);
    }),
  );
}

function toDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
}
