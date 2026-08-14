import type { CompanyCapacitySettingsRepository } from "@/modules/capacity/application/ports/company-capacity-settings-repository";
import type { DeveloperAvailabilityRepository } from "@/modules/capacity/application/ports/developer-availability-repository";
import type { CompanyRepository } from "@/modules/companies/domain/repositories/company-repository";
import type { MembershipRepository } from "@/modules/memberships/domain/repositories/membership-repository";
import type { UserRepository } from "@/modules/users/domain/repositories/user-repository";

export class InMemoryDeveloperAvailabilityRepository implements DeveloperAvailabilityRepository {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly memberships: MembershipRepository,
    private readonly users: UserRepository,
  ) {}

  async countAvailableDevelopers(companyId: string): Promise<number> {
    const company = await this.companies.findById(companyId);
    if (!company?.isActive) return 0;

    const memberships = await this.memberships.listByCompany(companyId);
    const eligible = await Promise.all(
      memberships
        .filter((membership) => membership.isActive && membership.position === "DESENVOLVEDOR")
        .map(async (membership) => {
          const user = await this.users.findById(membership.userId);
          return user?.isActive ? membership.userId : null;
        }),
    );

    return new Set(eligible.filter((userId): userId is string => userId !== null)).size;
  }
}

export class InMemoryCompanyCapacitySettingsRepository
  implements CompanyCapacitySettingsRepository
{
  private readonly values = new Map<string, number>();

  async getDailyHoursPerDeveloper(companyId: string): Promise<number | null> {
    return this.values.get(companyId) ?? null;
  }

  async setDailyHoursPerDeveloper(
    companyId: string,
    dailyHoursPerDeveloper: number,
  ): Promise<number> {
    this.values.set(companyId, dailyHoursPerDeveloper);
    return dailyHoursPerDeveloper;
  }
}
