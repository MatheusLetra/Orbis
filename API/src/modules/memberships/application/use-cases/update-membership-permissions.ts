import {
  toMembershipOutput,
  type UpdateMembershipPermissionsInput,
  updateMembershipPermissionsSchema,
} from "@/modules/memberships/application/dto/membership-dtos";
import type { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import type { MembershipRepository } from "@/modules/memberships/domain/repositories/membership-repository";
import type { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { NotFoundError, ValidationError } from "@/shared/errors/typed-errors";

export class UpdateMembershipPermissions {
  constructor(
    private readonly repository: MembershipRepository,
    private readonly accessService: MembershipAccessService,
    private readonly authorization: AuthorizationService,
  ) {}

  async execute(input: {
    actor: AuthenticatedUser;
    membershipId: string;
    data: UpdateMembershipPermissionsInput;
  }) {
    const parsed = updateMembershipPermissionsSchema.safeParse(input.data);
    if (!parsed.success) {
      throw new ValidationError("Permissões inválidas", {
        details: { issues: parsed.error.issues },
      });
    }
    this.authorization.assertCompanyContext(input.actor, input.actor.companyId);
    this.authorization.assertPermission(input.actor, "permissions.manage");
    await this.accessService.assertAccess(input.actor.userId, input.actor.companyId);
    const membership = await this.repository.findById(input.membershipId);
    if (!membership || membership.companyId !== input.actor.companyId) {
      throw new NotFoundError("Membership não encontrada");
    }
    membership.changePermissions(parsed.data.permissions);
    return toMembershipOutput(await this.repository.update(membership));
  }
}
