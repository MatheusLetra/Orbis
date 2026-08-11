import type { AuthenticatedUser } from "@/shared/application/authenticated-user";

export interface PermissionResolver {
  resolve(userId: string, companyId: string): Promise<AuthenticatedUser>;
}
