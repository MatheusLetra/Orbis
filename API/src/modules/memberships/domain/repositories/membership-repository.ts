import type { Membership } from "@/modules/memberships/domain/entities/membership";

export interface MembershipRepository {
  create(membership: Membership): Promise<Membership>;
  findById(id: string): Promise<Membership | null>;
  findByUserAndCompany(userId: string, companyId: string): Promise<Membership | null>;
  listByUser(userId: string): Promise<Membership[]>;
  listByCompany(companyId: string): Promise<Membership[]>;
  update(membership: Membership): Promise<Membership>;
}
