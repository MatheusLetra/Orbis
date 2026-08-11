import { z } from "zod";

import type { Membership } from "../../domain/entities/membership.js";

export const createMembershipSchema = z.object({
  companyId: z.string().uuid("companyId inválido"),
  userId: z.string().uuid("userId inválido"),
  position: z.string().trim().min(1, "Cargo é obrigatório").max(50, "Cargo muito longo"),
});

export type CreateMembershipInput = z.infer<typeof createMembershipSchema>;

export interface MembershipOutput {
  id: string;
  companyId: string;
  userId: string;
  position: string;
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
    isActive: membership.isActive,
    createdAt: membership.createdAt.toISOString(),
    updatedAt: membership.updatedAt.toISOString(),
  };
}
