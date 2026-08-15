import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/infrastructure/database/client";
import { companies } from "@/infrastructure/database/schema";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { DrizzleMembershipRepository } from "@/modules/memberships/infrastructure/repositories/drizzle-membership-repository";
import { DrizzleMembershipUnitOfWork } from "@/modules/memberships/infrastructure/unit-of-work/drizzle-membership-unit-of-work";
import { User } from "@/modules/users/domain/entities/user";
import { DrizzleUserRepository } from "@/modules/users/infrastructure/repositories/drizzle-user-repository";
import { createTestDatabase, isTestDatabaseAvailable } from "@/test/db-test-helper";

const available = await isTestDatabaseAvailable();
const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

describe.skipIf(!available)("DrizzleMembershipUnitOfWork", () => {
  let db: Database;
  let unitOfWork: DrizzleMembershipUnitOfWork;

  beforeAll(async () => {
    db = await createTestDatabase();
    unitOfWork = new DrizzleMembershipUnitOfWork(db);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE memberships, companies, users CASCADE;`);
    await db.insert(companies).values({ id: COMPANY_ID, name: "Orbis", timezone: "UTC" });
  });

  afterAll(async () => {
    await db?.$client.end();
  });

  it("confirma usuário e membership juntos", async () => {
    await unitOfWork.execute(async ({ users, memberships }) => {
      await users.create(
        User.create(
          { email: "user@example.com", name: "User", passwordHash: "scrypt:hash" },
          USER_ID,
        ),
      );
      await memberships.create(
        Membership.create({ companyId: COMPANY_ID, userId: USER_ID, position: "SUPORTE" }),
      );
    });

    await expect(new DrizzleUserRepository(db).findById(USER_ID)).resolves.not.toBeNull();
    await expect(
      new DrizzleMembershipRepository(db).findByUserAndCompany(USER_ID, COMPANY_ID),
    ).resolves.not.toBeNull();
  });

  it("reverte o usuário se a membership falhar", async () => {
    await expect(
      unitOfWork.execute(async ({ users, memberships }) => {
        await users.create(
          User.create(
            { email: "user@example.com", name: "User", passwordHash: "scrypt:hash" },
            USER_ID,
          ),
        );
        await memberships.create(
          Membership.create({ companyId: COMPANY_ID, userId: USER_ID, position: "SUPORTE" }),
        );
        throw new Error("forced rollback");
      }),
    ).rejects.toThrow("forced rollback");

    await expect(new DrizzleUserRepository(db).findById(USER_ID)).resolves.toBeNull();
  });
});
