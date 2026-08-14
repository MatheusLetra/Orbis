import type { HolidayDates } from "@/modules/capacity/domain/services/business-calendar";

export interface CalculateCapacityInput {
  companyId: string;
  startDate: Date;
  estimatedHours: number;
  holidays?: HolidayDates;
}

export interface CapacityCalculationOutput {
  companyId: string;
  startDate: Date;
  estimatedHours: number;
  availableDevelopers: number;
  dailyHoursPerDeveloper: number;
  dailyCapacity: number;
  requiredDays: number;
  plannedDeliveryDate: Date;
}
