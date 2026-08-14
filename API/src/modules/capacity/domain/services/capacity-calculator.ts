import type {
  BusinessCalendar,
  HolidayDates,
} from "@/modules/capacity/domain/services/business-calendar";
import { BusinessRuleError } from "@/shared/errors/typed-errors";

export interface CalculateCapacityInput {
  startDate: Date;
  estimatedHours: number;
  availableDevelopers: number;
  dailyHoursPerDeveloper: number;
  holidays?: HolidayDates;
}

export interface CapacityCalculation {
  dailyCapacity: number;
  requiredDays: number;
  plannedDeliveryDate: Date;
}

export class CapacityCalculator {
  constructor(private readonly calendar: BusinessCalendar) {}

  calculate(input: CalculateCapacityInput): CapacityCalculation {
    validateNumber(input.estimatedHours, "Estimativa de horas", (value) => value >= 0);
    validateNumber(
      input.availableDevelopers,
      "Quantidade de desenvolvedores",
      (value) => Number.isInteger(value) && value >= 0,
    );
    validateNumber(
      input.dailyHoursPerDeveloper,
      "Horas diárias por desenvolvedor",
      (value) => value > 0,
    );

    const dailyCapacity = input.availableDevelopers * input.dailyHoursPerDeveloper;
    if (!Number.isFinite(dailyCapacity) || dailyCapacity <= 0) {
      throw new BusinessRuleError("Capacidade diária deve ser maior que zero");
    }

    const requiredDays = input.estimatedHours / dailyCapacity;
    if (input.estimatedHours === 0) {
      this.calendar.isBusinessDay(input.startDate, input.holidays);
      return {
        dailyCapacity,
        requiredDays,
        plannedDeliveryDate: new Date(input.startDate.getTime()),
      };
    }

    const plannedDeliveryDate = this.calendar.addBusinessDays(
      input.startDate,
      Math.ceil(requiredDays),
      input.holidays,
    );
    validatePlannedDeliveryDate(plannedDeliveryDate, input.startDate);

    return {
      dailyCapacity,
      requiredDays,
      plannedDeliveryDate: new Date(plannedDeliveryDate.getTime()),
    };
  }
}

function validateNumber(value: number, field: string, predicate: (value: number) => boolean): void {
  if (!Number.isFinite(value) || !predicate(value)) {
    throw new BusinessRuleError(`${field} inválida`);
  }
}

function validatePlannedDeliveryDate(plannedDeliveryDate: Date, startDate: Date): void {
  if (!(plannedDeliveryDate instanceof Date) || Number.isNaN(plannedDeliveryDate.getTime())) {
    throw new BusinessRuleError("Data prevista inválida");
  }
  if (plannedDeliveryDate < startDate) {
    throw new BusinessRuleError("Data prevista não pode ser anterior à data inicial");
  }
}
