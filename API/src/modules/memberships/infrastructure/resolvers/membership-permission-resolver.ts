import type { MembershipRepository } from "@/modules/memberships/domain/repositories/membership-repository";
import type { PermissionResolver } from "@/modules/permissions/application/ports/permission-resolver";
import {
  type DashboardPolicy,
  DEFAULT_DASHBOARD_POLICY,
} from "@/modules/permissions/domain/dashboard-policy";
import type { Permission } from "@/modules/permissions/domain/permission";
import { permissionsForPosition } from "@/modules/permissions/domain/role";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { ForbiddenError } from "@/shared/errors/typed-errors";

export class MembershipPermissionResolver implements PermissionResolver {
  constructor(
    private readonly membershipRepository: MembershipRepository,
    private readonly dashboardPolicy: DashboardPolicy = DEFAULT_DASHBOARD_POLICY,
  ) {}

  async resolve(userId: string, companyId: string): Promise<AuthenticatedUser> {
    const membership = await this.membershipRepository.findByUserAndCompany(userId, companyId);

    if (!membership?.isActive) {
      throw new ForbiddenError("Usuário não possui acesso a esta empresa");
    }

    const base =
      membership.permissions.length > 0
        ? membership.permissions
        : permissionsForPosition(membership.position);
    const dashboard = this.dashboardPolicy.resolveFor(membership.position, userId);
    const permissions = [...new Set<Permission>([...base, ...dashboard])];

    return { userId, companyId, permissions };
  }
}
