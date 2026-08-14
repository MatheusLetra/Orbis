import { z } from "zod";

import type {
  CalculateCapacityInput,
  CapacityCalculationOutput,
} from "@/modules/capacity/application/dto/capacity-dtos";
import type { CompanyCapacitySettingsRepository } from "@/modules/capacity/application/ports/company-capacity-settings-repository";
import type { DeveloperAvailabilityRepository } from "@/modules/capacity/application/ports/developer-availability-repository";
import type { CapacityCalculator } from "@/modules/capacity/domain/services/capacity-calculator";
import type { CompanyRepository } from "@/modules/companies/domain/repositories/company-repository";
import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import {
  CapacityConfigurationMissingError,
  CapacityZeroError,
  NotFoundError,
  ValidationError,
} from "@/shared/errors/typed-errors";

const inputSchema = z
  .object({
    companyId: z.string().uuid("companyId inválido"),
    startDate: z.date().refine((value) => !Number.isNaN(value.getTime()), "startDate inválida"),
    estimatedHours: z.number().finite().min(0, "estimatedHours inválida"),
  })
  .strict();

export interface CalculateCapacityCommand extends CalculateCapacityInput {
  actor: AuthenticatedUser;
}

export class CalculateCapacity
  implements UseCase<CalculateCapacityCommand, CapacityCalculationOutput>
{
  constructor(
    private readonly availabilityRepository: DeveloperAvailabilityRepository,
    private readonly settingsRepository: CompanyCapacitySettingsRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
    private readonly calculator: CapacityCalculator,
  ) {}

  async execute(input: CalculateCapacityCommand): Promise<CapacityCalculationOutput> {
    const parsed = inputSchema.safeParse({
      companyId: input.companyId,
      startDate: input.startDate,
      estimatedHours: input.estimatedHours,
    });
    if (!parsed.success) {
      throw new ValidationError("Entrada de capacidade inválida", {
        details: { issues: parsed.error.issues },
      });
    }

    this.authorization.assertCompanyContext(input.actor, parsed.data.companyId);
    this.authorization.assertPermission(input.actor, "capacity.read");
    await this.accessService.assertAccess(input.actor.userId, parsed.data.companyId);

    const company = await this.companyRepository.findById(parsed.data.companyId);
    if (!company?.isActive) throw new NotFoundError("Empresa não encontrada");

    const availableDevelopers = await this.availabilityRepository.countAvailableDevelopers(
      parsed.data.companyId,
    );
    const dailyHoursPerDeveloper = await this.settingsRepository.getDailyHoursPerDeveloper(
      parsed.data.companyId,
    );

    if (dailyHoursPerDeveloper === null) {
      throw new CapacityConfigurationMissingError("A capacidade da empresa não está configurada");
    }
    if (availableDevelopers === 0) {
      throw new CapacityZeroError("A capacidade diária deve ser maior que zero");
    }

    const calculation = this.calculator.calculate({
      startDate: parsed.data.startDate,
      estimatedHours: parsed.data.estimatedHours,
      availableDevelopers,
      dailyHoursPerDeveloper,
      holidays: input.holidays,
    });

    return {
      companyId: parsed.data.companyId,
      startDate: new Date(parsed.data.startDate.getTime()),
      estimatedHours: parsed.data.estimatedHours,
      availableDevelopers,
      dailyHoursPerDeveloper,
      dailyCapacity: calculation.dailyCapacity,
      requiredDays: calculation.requiredDays,
      plannedDeliveryDate: new Date(calculation.plannedDeliveryDate.getTime()),
    };
  }
}
