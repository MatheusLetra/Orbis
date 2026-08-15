import type { MembershipRepository } from "@/modules/memberships/domain/repositories/membership-repository";
import type { UserRepository } from "@/modules/users/domain/repositories/user-repository";

export interface MembershipUnitOfWorkRepositories {
  memberships: MembershipRepository;
  users: UserRepository;
}

export interface MembershipUnitOfWork {
  execute<T>(work: (repositories: MembershipUnitOfWorkRepositories) => Promise<T>): Promise<T>;
}
