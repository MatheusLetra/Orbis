import { eq } from "drizzle-orm";

import type { Database } from "@/infrastructure/database/client";
import { users } from "@/infrastructure/database/schema";
import type { User } from "@/modules/users/domain/entities/user";
import type { UserRepository } from "@/modules/users/domain/repositories/user-repository";
import { toEntity, toInsertValues } from "@/modules/users/infrastructure/mappers/user-mapper";
import { requireRow } from "@/shared/utils/require-row";

type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DatabaseExecutor = Database | DatabaseTransaction;

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async create(user: User): Promise<User> {
    const rows = await this.db.insert(users).values(toInsertValues(user)).returning();

    return toEntity(requireRow(rows[0]));
  }

  async findById(id: string): Promise<User | null> {
    const row = (await this.db.select().from(users).where(eq(users.id, id)))[0];

    return row ? toEntity(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = (await this.db.select().from(users).where(eq(users.email, email)))[0];

    return row ? toEntity(row) : null;
  }

  async update(user: User): Promise<User> {
    const rows = await this.db
      .update(users)
      .set(toInsertValues(user))
      .where(eq(users.id, user.id))
      .returning();

    return toEntity(requireRow(rows[0]));
  }
}
