import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import {
  type ListRequisitionsInput,
  listRequisitionsSchema,
  type RequisitionOutput,
  toRequisitionOutput,
} from "@/modules/requisitions/application/dto/requisition-dtos";
import type { RequisitionRepository } from "@/modules/requisitions/domain/repositories/requisition-repository";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { ValidationError } from "@/shared/errors/typed-errors";

export interface ListRequisitionsCommand {
  actor: AuthenticatedUser;
  filters?: ListRequisitionsInput;
}

export class ListRequisitions implements UseCase<ListRequisitionsCommand, RequisitionOutput[]> {
  constructor(
    private readonly requisitionRepository: RequisitionRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: ListRequisitionsCommand): Promise<RequisitionOutput[]> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "requisitions.read");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const parsed = listRequisitionsSchema.safeParse(input.filters ?? {});
    if (!parsed.success) {
      throw new ValidationError("Filtros de requisição inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    const requisitions = await this.requisitionRepository.listByCompany(
      input.actor.companyId,
      parsed.data,
    );

    return requisitions.map(toRequisitionOutput);
  }
}
