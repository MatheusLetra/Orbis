export interface DeveloperAvailabilityRepository {
  countAvailableDevelopers(companyId: string): Promise<number>;
}
