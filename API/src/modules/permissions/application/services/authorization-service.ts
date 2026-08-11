import type { Permission } from "@/modules/permissions/domain/permission";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { ForbiddenError } from "@/shared/errors/typed-errors";

export class AuthorizationService {
  assertPermission(user: AuthenticatedUser, permission: Permission): void {
    if (!user.permissions.includes(permission)) {
      throw new ForbiddenError(`Permissão necessária: ${permission}`);
    }
  }

  assertCompanyContext(user: AuthenticatedUser, companyId: string): void {
    if (user.companyId !== companyId) {
      throw new ForbiddenError("Usuário não possui acesso a esta empresa");
    }
  }
}
