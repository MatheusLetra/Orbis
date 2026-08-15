import { z } from "zod";

import type { Membership } from "@/modules/memberships/domain/entities/membership";
import { PERMISSIONS } from "@/modules/permissions/domain/permission";
import { ROLES } from "@/modules/permissions/domain/role";
import { createUserSchema } from "@/modules/users/application/dto/user-dtos";

export const createMembershipSchema = z.object({
  companyId: z.string().uuid("companyId inválido"),
  userId: z.string().uuid("userId inválido"),
  position: z.string().trim().min(1, "Cargo é obrigatório").max(50, "Cargo muito longo"),
});

export type CreateMembershipInput = z.infer<typeof createMembershipSchema>;

export const createCompanyMemberSchema = createUserSchema.extend({
  position: z.enum(ROLES),
});

export type CreateCompanyMemberInput = z.infer<typeof createCompanyMemberSchema>;

export const updateMembershipPermissionsSchema = z
  .object({
    permissions: z
      .array(z.enum(PERMISSIONS))
      .refine((values) => new Set(values).size === values.length, "Permissões duplicadas"),
  })
  .strict();

export type UpdateMembershipPermissionsInput = z.infer<typeof updateMembershipPermissionsSchema>;

export interface MembershipOutput {
  id: string;
  companyId: string;
  userId: string;
  position: string;
  permissions: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toMembershipOutput(membership: Membership): MembershipOutput {
  return {
    id: membership.id,
    companyId: membership.companyId,
    userId: membership.userId,
    position: membership.position,
    permissions: membership.permissions,
    isActive: membership.isActive,
    createdAt: membership.createdAt.toISOString(),
    updatedAt: membership.updatedAt.toISOString(),
  };
}
