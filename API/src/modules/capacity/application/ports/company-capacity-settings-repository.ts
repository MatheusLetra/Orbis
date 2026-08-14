export interface CompanyCapacitySettingsRepository {
  getDailyHoursPerDeveloper(companyId: string): Promise<number | null>;
  setDailyHoursPerDeveloper(companyId: string, dailyHoursPerDeveloper: number): Promise<number>;
}
