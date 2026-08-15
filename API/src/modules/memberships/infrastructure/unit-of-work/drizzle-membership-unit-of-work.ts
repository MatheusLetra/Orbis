import type { Database } from "@/infrastructure/database/client";
import type {
  MembershipUnitOfWork,
  MembershipUnitOfWorkRepositories,
} from "@/modules/memberships/application/ports/membership-unit-of-work";
import { DrizzleMembershipRepository } from "@/modules/memberships/infrastructure/repositories/drizzle-membership-repository";
import { DrizzleUserRepository } from "@/modules/users/infrastructure/repositories/drizzle-user-repository";

export class DrizzleMembershipUnitOfWork implements MembershipUnitOfWork {
  constructor(private readonly db: Database) {}

  async execute<T>(
    work: (repositories: MembershipUnitOfWorkRepositories) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction((transaction) =>
      work({
        memberships: new DrizzleMembershipRepository(transaction),
        users: new DrizzleUserRepository(transaction),
      }),
    );
  }
}
