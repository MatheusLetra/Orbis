import { eq } from "drizzle-orm";

import type { Database } from "../../../../infrastructure/database/client.js";
import { users } from "../../../../infrastructure/database/schema.js";
import { requireRow } from "../../../../shared/utils/require-row.js";
import type { User } from "../../domain/entities/user.js";
import type { UserRepository } from "../../domain/repositories/user-repository.js";
import { toEntity, toInsertValues } from "../mappers/user-mapper.js";

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

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
