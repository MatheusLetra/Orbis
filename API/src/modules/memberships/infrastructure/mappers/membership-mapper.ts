import { Membership } from "@/modules/memberships/domain/entities/membership";

export type MembershipRow = {
  id: string;
  companyId: string;
  userId: string;
  position: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function toEntity(row: MembershipRow): Membership {
  return Membership.restore({
    id: row.id,
    companyId: row.companyId,
    userId: row.userId,
    position: row.position ?? "",
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function toInsertValues(membership: Membership): MembershipRow {
  return {
    id: membership.id,
    companyId: membership.companyId,
    userId: membership.userId,
    position: membership.position,
    isActive: membership.isActive,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
  };
}
