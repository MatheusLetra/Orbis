import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type {
  CompanyMemberLookupRepository,
  CompanyMembershipLookup,
} from "@/modules/memberships/domain/repositories/company-member-lookup-repository";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";

export class ListCompanyMemberships {
  constructor(
    private readonly repository: CompanyMemberLookupRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: { actor: AuthenticatedUser }): Promise<CompanyMembershipLookup[]> {
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "users.read");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);
    return this.repository.listMembershipsByCompany(input.actor.companyId);
  }
}
