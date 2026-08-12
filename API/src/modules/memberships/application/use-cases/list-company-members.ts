import { z } from "zod";

import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { CompanyMemberLookupRepository } from "@/modules/memberships/domain/repositories/company-member-lookup-repository";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import type { UseCase } from "@/shared/application/use-case";
import { ValidationError } from "@/shared/errors/typed-errors";

const listCompanyMembersSchema = z
  .object({
    search: z
      .string()
      .trim()
      .max(200, "Pesquisa não pode exceder 200 caracteres")
      .transform((value) => value || undefined)
      .optional(),
  })
  .strict();

export interface ListCompanyMembersCommand {
  actor: AuthenticatedUser;
  search?: string;
}

export class ListCompanyMembers
  implements UseCase<ListCompanyMembersCommand, { userId: string; name: string }[]>
{
  constructor(
    private readonly repository: CompanyMemberLookupRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: ListCompanyMembersCommand): Promise<{ userId: string; name: string }[]> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "users.read");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);

    const parsed = listCompanyMembersSchema.safeParse({ search: input.search });
    if (!parsed.success) {
      throw new ValidationError("Filtros de membros inválidos", {
        details: { issues: parsed.error.issues },
      });
    }

    return this.repository.listActiveByCompany(input.actor.companyId, parsed.data.search);
  }
}
