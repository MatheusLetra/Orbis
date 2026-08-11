import type { Permission } from "@/modules/permissions/domain/permission";

export interface AuthenticatedUser {
  userId: string;
  companyId: string;
  permissions: Permission[];
}
