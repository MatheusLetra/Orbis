import type { MembershipRepository } from "@/modules/memberships/domain/repositories/membership-repository";
import type { ReleaseRecipientResolver } from "@/modules/notifications/application/ports/release-recipient-resolver";
import { permissionsForPosition } from "@/modules/permissions/domain/role";
import type { UserRepository } from "@/modules/users/domain/repositories/user-repository";

export class MembershipReleaseRecipientResolver implements ReleaseRecipientResolver {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly users: UserRepository,
  ) {}

  async resolve(companyId: string): Promise<string[]> {
    const memberships = await this.memberships.listByCompany(companyId);
    const eligible = memberships.filter((membership) => {
      if (!membership.isActive) return false;
      const permissions =
        membership.permissions.length > 0
          ? membership.permissions
          : permissionsForPosition(membership.position);
      return permissions.includes("releases.read");
    });
    const users = await Promise.all(
      eligible.map((membership) => this.users.findById(membership.userId)),
    );
    return eligible
      .filter((_, index) => users[index]?.isActive)
      .map((membership) => membership.userId);
  }
}
